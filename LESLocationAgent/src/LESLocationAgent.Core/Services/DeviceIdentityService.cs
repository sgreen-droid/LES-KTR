using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using LESLocationAgent.Core.Models;

namespace LESLocationAgent.Core.Services;

/// <summary>
/// Maintains a random installation identity and sequence counter used by
/// recovery telemetry. The data remains machine-local in ProgramData.
/// </summary>
public sealed class DeviceIdentityService
{
    public const string IntegrityAlgorithm = "HMAC-SHA256-IEEE754LE";

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true
    };
    private readonly string _stateFilePath;
    private readonly string _dataDirectory;
    private readonly string _lockFilePath;
    private readonly string _initializedPath;

    public DeviceIdentityService(string? stateFilePath = null)
    {
        _stateFilePath = stateFilePath ?? AppConfig.DeviceIdentityFilePath;
        _dataDirectory = Path.GetDirectoryName(_stateFilePath)
            ?? throw new ArgumentException("A device identity path must include a directory.", nameof(stateFilePath));
        _lockFilePath = $"{_stateFilePath}.lock";
        _initializedPath = $"{_stateFilePath}.initialized";
    }

    public DeviceIdentity GetOrCreate()
    {
        return WithStateLock(() =>
        {
            return GetOrCreateUnsafe();
        });
    }

    /// <summary>
    /// Reserves the next sequence before a location file is written. A crash
    /// can leave a gap, but records will never reuse an earlier sequence.
    /// </summary>
    public DeviceIdentity ReserveNextLocationRecord()
    {
        return WithStateLock(() =>
        {
            var identity = GetOrCreateUnsafe();
            if (identity.LastRecordSequence == long.MaxValue)
                throw new IdentityProtectionException("Identity protection blocked: record counter is exhausted; identity was preserved.");
            identity.LastRecordSequence++;
            Write(identity);
            return identity;
        });
    }

    public string CreateLocationIntegrityHmac(DeviceIdentity identity, LocationJson location)
    {
        var key = Convert.FromBase64String(identity.IntegrityKey);
        var payload = BuildLocationIntegrityPayload(location);

        using var hmac = new HMACSHA256(key);
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    public bool VerifyLocationIntegrity(LocationJson location)
    {
        if (string.IsNullOrWhiteSpace(location.DeviceId)
            || string.IsNullOrWhiteSpace(location.IntegrityHmac)
            || !string.Equals(location.IntegrityAlgorithm, IntegrityAlgorithm, StringComparison.Ordinal))
        {
            return false;
        }

        DeviceIdentity identity;
        try { identity = ReadExisting(); }
        catch (Exception ex) when (ex is IdentityProtectionException or FileNotFoundException) { return false; }
        if (!string.Equals(identity.DeviceId, location.DeviceId, StringComparison.Ordinal))
            return false;

        try
        {
            var expected = CreateLocationIntegrityHmac(identity, location);
            var expectedBytes = Convert.FromHexString(expected);
            var actualBytes = Convert.FromHexString(location.IntegrityHmac);
            return CryptographicOperations.FixedTimeEquals(expectedBytes, actualBytes);
        }
        catch
        {
            return false;
        }
    }

    public static string BuildLocationIntegrityPayload(LocationJson location)
    {
        return string.Join("|", new[]
        {
            location.DeviceId,
            location.RecordSequence.ToString(CultureInfo.InvariantCulture),
            location.TimestampUtc,
            GetIeee754LittleEndianHex(location.Latitude),
            GetIeee754LittleEndianHex(location.Longitude),
            GetIeee754LittleEndianHex(location.AccuracyMeters),
            location.PermissionStatus,
            location.AgentVersion
        });
    }

    private static string GetIeee754LittleEndianHex(double value) =>
        Convert.ToHexString(BitConverter.GetBytes(value));

    private DeviceIdentity GetOrCreateUnsafe()
    {
        try
        {
            var existing = ReadExisting();
            EnsureInitializationMarker();
            return existing;
        }
        catch (IdentityProtectionException) { throw; }
        catch (FileNotFoundException)
        {
            // Only positively missing files permit first-install initialization.
            // File.Exists also returns false for access errors and is not safe here.
        }

        foreach (var evidence in new[] { _initializedPath,
            Path.Combine(_dataDirectory, "location.json"), Path.Combine(_dataDirectory, "status.json") })
        {
            if (PathPresent(evidence))
                throw new IdentityProtectionException(
                    "Identity protection blocked: identity is missing but prior installation evidence exists; no replacement was created.");
        }

        var identity = new DeviceIdentity
        {
            DeviceId = Guid.NewGuid().ToString("D"),
            CreatedUtc = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            LastRecordSequence = 0,
            IntegrityKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        };

        // Mark first, so interruption cannot silently authorize a second identity.
        EnsureInitializationMarker();
        Write(identity, createOnly: true);
        return identity;
    }

    private static bool PathPresent(string path)
    {
        try { _ = File.GetAttributes(path); return true; }
        catch (FileNotFoundException) { return false; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            throw new IdentityProtectionException("Identity protection blocked: prior installation evidence cannot be inspected.");
        }
    }

    private void EnsureInitializationMarker()
    {
        try
        {
            if (PathPresent(_initializedPath)) return;
            using var marker = new FileStream(_initializedPath, FileMode.CreateNew, FileAccess.Write, FileShare.Read);
            marker.Flush(flushToDisk: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            throw new IdentityProtectionException("Identity protection blocked: initialization safeguard cannot be persisted; identity was preserved.");
        }
    }

    private T WithStateLock<T>(Func<T> action)
    {
        try { Directory.CreateDirectory(_dataDirectory); }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            throw new IdentityProtectionException("Identity protection blocked: identity directory is inaccessible.");
        }

        const int maxAttempts = 100;
        for (var attempt = 0; attempt < maxAttempts; attempt++)
        {
            FileStream lockHandle;
            try
            {
                lockHandle = new FileStream(
                    _lockFilePath,
                    FileMode.OpenOrCreate,
                    FileAccess.ReadWrite,
                    FileShare.None);
            }
            catch (IOException) when (attempt < maxAttempts - 1)
            {
                Thread.Sleep(100);
                continue;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                throw new IdentityProtectionException("Identity protection blocked: exclusive identity access is unavailable.");
            }
            // Retry lock acquisition only, never replay a partially completed write.
            using (lockHandle) return action();
        }

        throw new TimeoutException(
            "Timed out waiting for exclusive access to the recovery identity state.");
    }

    private DeviceIdentity ReadExisting()
    {
        var existed = false;
        try
        {
            var attributes = File.GetAttributes(_stateFilePath);
            existed = true;
            if ((attributes & (FileAttributes.Directory | FileAttributes.ReparsePoint)) != 0)
                throw new IdentityProtectionException("Identity protection blocked: identity path is not a regular file.");
            using var stream = new FileStream(_stateFilePath, FileMode.Open, FileAccess.Read,
                FileShare.ReadWrite | FileShare.Delete);
            if (stream.Length > 65_536)
                throw new IdentityProtectionException("Identity protection blocked: identity file exceeds the supported size.");
            using var document = JsonDocument.Parse(stream);
            var root = document.RootElement;
            var required = new[] { "deviceId", "createdUtc", "lastRecordSequence", "integrityKey" };
            if (root.ValueKind != JsonValueKind.Object ||
                required.Any(name => root.EnumerateObject().Count(p => p.Name == name) != 1))
                throw new IdentityProtectionException("Identity protection blocked: identity has missing or duplicate fields; original file was preserved.");
            var identity = root.Deserialize<DeviceIdentity>();
            if (!IsValid(identity))
                throw new IdentityProtectionException("Identity protection blocked: identity is invalid; original file was preserved.");
            return identity!;
        }
        catch (FileNotFoundException) when (!existed) { throw; }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or NotSupportedException)
        {
            throw new IdentityProtectionException("Identity protection blocked: identity cannot be read or parsed; original file was preserved.");
        }
    }

    private static bool IsValid(DeviceIdentity? identity)
    {
        if (identity is null
            || !Guid.TryParse(identity.DeviceId, out var id) || id == Guid.Empty
            || !DateTimeOffset.TryParse(identity.CreatedUtc, CultureInfo.InvariantCulture,
                DateTimeStyles.RoundtripKind, out _)
            || identity.LastRecordSequence < 0)
        {
            return false;
        }

        try
        {
            return Convert.FromBase64String(identity.IntegrityKey).Length == 32;
        }
        catch
        {
            return false;
        }
    }

    private void Write(DeviceIdentity identity, bool createOnly = false)
    {
        var tempPath = $"{_stateFilePath}.{Guid.NewGuid():N}.tmp";
        var json = JsonSerializer.Serialize(identity, JsonOptions);

        try
        {
            File.WriteAllText(tempPath, json, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            File.Move(tempPath, _stateFilePath, overwrite: !createOnly);
        }
        finally
        {
            if (File.Exists(tempPath))
                File.Delete(tempPath);
        }
    }
}