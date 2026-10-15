using LESLocationAgent.Core.Helpers;
using LESLocationAgent.Core.Models;
using LESLocationAgent.Core.Services;
using Xunit;

namespace LESLocationAgent.Tests;

public class CollectionDeadlineTests
{
    [Fact]
    public async Task SuccessfulRequestReturnsItsResult() =>
        Assert.Equal(42, await CollectionDeadline.RunAsync(() => Task.FromResult(42), TimeSpan.FromSeconds(2)));

    [Fact]
    public async Task RequestFailureIsNotMisreportedAsTimeout() =>
        await Assert.ThrowsAsync<InvalidOperationException>(() =>
            CollectionDeadline.RunAsync<int>(() => throw new InvalidOperationException(), TimeSpan.FromSeconds(2)));

    [Fact]
    public async Task NonCooperatingProviderIsBounded()
    {
        var provider = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
        await Assert.ThrowsAsync<TimeoutException>(() =>
            CollectionDeadline.RunAsync(() => provider.Task, TimeSpan.FromMilliseconds(50)));
        provider.SetResult(42); // A late completion cannot change the timed-out result.
    }

    [Fact]
    public async Task SynchronousActivationIsAlsoBounded()
    {
        using var gate = new SemaphoreSlim(0);
        var finished = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        try
        {
            await Assert.ThrowsAsync<TimeoutException>(() => CollectionDeadline.RunAsync(() =>
            {
                gate.Wait();
                finished.TrySetResult();
                return Task.FromResult(1);
            }, TimeSpan.FromMilliseconds(50)));
        }
        finally
        {
            gate.Release();
            await finished.Task.WaitAsync(TimeSpan.FromSeconds(5));
        }
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public async Task InvalidBudgetRejected(int milliseconds) =>
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(() =>
            CollectionDeadline.RunAsync(() => Task.FromResult(1), TimeSpan.FromMilliseconds(milliseconds)));

    [Fact]
    public void BudgetLeavesTimeBeforeSchedulerTermination() =>
        Assert.True(CollectionDeadline.BackgroundBudget < TimeSpan.FromMinutes(3));

    [Fact]
    public async Task AttemptAndTimeoutDoNotEraseLastSuccessOrSignedLocation()
    {
        var directory = Path.Combine(Path.GetTempPath(), "les-deadline-" + Guid.NewGuid().ToString("N"));
        try
        {
            var files = new LocationFileService(directory);
            files.WriteLocation(new LocationReading {
                Latitude = 0, Longitude = 0, AccuracyMeters = 25,
                Timestamp = DateTimeOffset.UtcNow, PositionSource = "WiFi"
            }, "Allowed");
            files.WriteStatus("Success", "Allowed", lastSuccess: DateTimeOffset.UtcNow);
            var previous = files.ReadStatus()!;
            var before = File.ReadAllBytes(Path.Combine(directory, "location.json"));
            files.WriteStatus("Collecting", "Allowed");
            Assert.Equal("COLLECTING", files.ReadStatus()!.AgentHealth);
            var provider = new TaskCompletionSource<int>(TaskCreationOptions.RunContinuationsAsynchronously);
            await Assert.ThrowsAsync<TimeoutException>(() =>
                CollectionDeadline.RunAsync(() => provider.Task, TimeSpan.FromMilliseconds(50)));
            files.WriteStatus("TimedOut", "Allowed", error: "Independent deadline exceeded.");
            var status = files.ReadStatus()!;
            Assert.Equal("LOCATION TIMED OUT", status.AgentHealth);
            Assert.Equal(previous.LastSuccessUtc, status.LastSuccessUtc);
            Assert.Equal(previous.RecordSequence, status.RecordSequence);
            Assert.Equal(previous.DeviceId, status.DeviceId);
            Assert.Equal("VALID", status.IntegrityStatus);
            Assert.Equal(before, File.ReadAllBytes(Path.Combine(directory, "location.json")));
        }
        finally { if (Directory.Exists(directory)) Directory.Delete(directory, true); }
    }
}
