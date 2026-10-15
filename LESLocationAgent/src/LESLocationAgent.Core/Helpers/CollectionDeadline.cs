namespace LESLocationAgent.Core.Helpers;

/// <summary>Independent of a provider's own timeout/cancellation implementation.</summary>
public static class CollectionDeadline
{
    // Leave time for status persistence and clean exit before the task's 3-minute limit.
    public static readonly TimeSpan BackgroundBudget = TimeSpan.FromMinutes(2);

    public static async Task<T> RunAsync<T>(Func<Task<T>> request, TimeSpan budget)
    {
        ArgumentNullException.ThrowIfNull(request);
        if (budget <= TimeSpan.Zero || budget == Timeout.InfiniteTimeSpan)
            throw new ArgumentOutOfRangeException(nameof(budget));

        // WinRT activation can block before returning a Task. Do not let that
        // block the caller that enforces the deadline. A late result is ignored.
        return await Task.Run(request).WaitAsync(budget).ConfigureAwait(false);
    }
}
