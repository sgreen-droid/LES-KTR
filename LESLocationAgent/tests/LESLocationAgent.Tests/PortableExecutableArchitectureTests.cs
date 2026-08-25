using FluentAssertions;
using LESLocationAgent.Core.Helpers;
using Xunit;

namespace LESLocationAgent.Tests;

public sealed class PortableExecutableArchitectureTests
{
    [Theory]
    [InlineData(0x8664, "x64")]
    [InlineData(0x014C, "x86")]
    [InlineData(0xAA64, "arm64")]
    [InlineData(0x0200, "unknown (PE machine 0x0200)")]
    public void Inspect_ReturnsArchitectureFromPeMachineType(ushort machine, string expected)
    {
        using var stream = CreatePeFile(machine);

        PortableExecutableArchitecture.Inspect(stream).Should().Be(expected);
    }

    [Fact]
    public void Inspect_WhenTheFileIsNotAValidPe_ReturnsAnUnknownArchitecture()
    {
        using var stream = new MemoryStream(new byte[64]);

        PortableExecutableArchitecture.Inspect(stream)
            .Should().Be("unknown (invalid PE header)");
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(1024)]
    public void Inspect_WhenThePeHeaderOffsetIsOutsideTheFile_ReturnsAnUnknownArchitecture(int peHeaderOffset)
    {
        using var stream = CreateDosFile(peHeaderOffset);

        PortableExecutableArchitecture.Inspect(stream)
            .Should().Be("unknown (invalid PE header)");
    }

    [Fact]
    public void Inspect_WhenThePeSignatureIsInvalid_ReturnsAnUnknownArchitecture()
    {
        using var stream = CreateDosFile(0x80, length: 0x86);

        PortableExecutableArchitecture.Inspect(stream)
            .Should().Be("unknown (invalid PE header)");
    }

    [Fact]
    public void Inspect_WhenThePeHeaderDoesNotContainTheMachineField_ReturnsAnUnknownArchitecture()
    {
        using var stream = CreateDosFile(0x80, length: 0x85);
        stream.GetBuffer()[0x80] = (byte)'P';
        stream.GetBuffer()[0x81] = (byte)'E';

        PortableExecutableArchitecture.Inspect(stream)
            .Should().Be("unknown (invalid PE header)");
    }

    private static MemoryStream CreatePeFile(ushort machine)
    {
        const int peHeaderOffset = 0x80;
        var stream = CreateDosFile(peHeaderOffset, peHeaderOffset + 6);
        var bytes = stream.GetBuffer();
        bytes[peHeaderOffset] = (byte)'P';
        bytes[peHeaderOffset + 1] = (byte)'E';
        BitConverter.GetBytes(machine).CopyTo(bytes, peHeaderOffset + 4);
        return stream;
    }

    private static MemoryStream CreateDosFile(int peHeaderOffset, int length = 128)
    {
        var stream = new MemoryStream(length);
        stream.SetLength(length);
        var bytes = stream.GetBuffer();
        bytes[0] = (byte)'M';
        bytes[1] = (byte)'Z';
        BitConverter.GetBytes(peHeaderOffset).CopyTo(bytes, 0x3C);
        return stream;
    }
}