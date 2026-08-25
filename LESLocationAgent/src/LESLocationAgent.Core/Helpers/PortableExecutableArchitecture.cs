namespace LESLocationAgent.Core.Helpers;

/// <summary>
/// Reads a Portable Executable (PE) machine type without asking Windows to
/// execute or load the file. This works for both EXEs and DLLs.
/// </summary>
public static class PortableExecutableArchitecture
{
    private const ushort DosSignature = 0x5A4D; // MZ
    private const uint PeSignature = 0x00004550; // PE\0\0
    private const ushort MachineI386 = 0x014C;
    private const ushort MachineAmd64 = 0x8664;
    private const ushort MachineArm64 = 0xAA64;
    private const int PeHeaderOffsetLocation = 0x3C;
    private const int PeSignatureAndMachineLength = sizeof(uint) + sizeof(ushort);

    public static string Inspect(string filePath)
    {
        try
        {
            using var stream = File.OpenRead(filePath);
            return Inspect(stream);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return $"unknown ({ex.GetType().Name})";
        }
    }

    public static string Inspect(Stream stream)
    {
        ArgumentNullException.ThrowIfNull(stream);

        try
        {
            if (!stream.CanRead || !stream.CanSeek ||
                stream.Length < PeHeaderOffsetLocation + sizeof(int))
            {
                return "unknown (invalid PE header)";
            }

            using var reader = new BinaryReader(stream, System.Text.Encoding.UTF8, leaveOpen: true);

            stream.Position = 0;
            if (reader.ReadUInt16() != DosSignature)
            {
                return "unknown (invalid PE header)";
            }

            stream.Position = PeHeaderOffsetLocation;
            var peHeaderOffset = reader.ReadInt32();
            if (peHeaderOffset < 0 ||
                peHeaderOffset > stream.Length - PeSignatureAndMachineLength)
            {
                return "unknown (invalid PE header)";
            }

            stream.Position = peHeaderOffset;
            if (reader.ReadUInt32() != PeSignature)
            {
                return "unknown (invalid PE header)";
            }

            return reader.ReadUInt16() switch
            {
                MachineAmd64 => "x64",
                MachineI386 => "x86",
                MachineArm64 => "arm64",
                var machine => $"unknown (PE machine 0x{machine:X4})"
            };
        }
        catch (EndOfStreamException)
        {
            return "unknown (invalid PE header)";
        }
        catch (Exception ex) when (ex is IOException or NotSupportedException)
        {
            return $"unknown ({ex.GetType().Name})";
        }
    }
}