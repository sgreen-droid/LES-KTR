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

    public DeviceIdentityService(string? stateFilePath = null)
    {
        _stateFilePath = stateFilePath ?? AppConfig.DeviceIdentityFilePath;
        _dataDirectory = Path.GetDirectoryName(_stateFilePath)
            ?? throw new ArgumentException("A device identity path must include a directory.", nameof(stateFilePath));
        _lockFilePath = $"{_stateFilePath}.lock";
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

        var identity = GetOrCreate();
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
        var existing = TryRead();
        if (IsValid(existing))
            return existing!;

        var identity = new DeviceIdentity
        {
            DeviceId = Guid.NewGuid().ToString("D"),
            CreatedUtc = DateTimeOffset.UtcNow.ToString("yyyy-MM-ddTHH:mm:ssZ"),
            LastRecordSequence = 0,
            IntegrityKey = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
        };

        Write(identity);
        return identity;
    }

    private T WithStateLock<T>(Func<T> action)
    {
        Directory.CreateDirectory(_dataDirectory);

        const int maxAttempts = 100;
        for (var attempt = 0; attempt < maxAttempts; attempt++)
        {
            try
            {
                using var lockHandle = new FileStream(
                    _lockFilePath,
                    FileMode.OpenOrCreate,
                    FileAccess.ReadWrite,
                    FileShare.None);
                return action();
            }
            catch (IOException) when (attempt < maxAttempts - 1)
            {
                Thread.Sleep(100);
            }
        }

        throw new TimeoutException(
            "Timed out waiting for exclusive access to the recovery identity state.");
    }

    private DeviceIdentity? TryRead()
    {
        try
        {
            if (!File.Exists(_stateFilePath))
                return null;

            return JsonSerializer.Deserialize<DeviceIdentity>(
                File.ReadAllText(_stateFilePath));
        }
        catch
        {
            return null;
        }
    }

    private static bool IsValid(DeviceIdentity? identity)
    {
        if (identity is null
            || !Guid.TryParse(identity.DeviceId, out _)
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

    private void Write(DeviceIdentity identity)
    {
        var tempPath = $"{_stateFilePath}.{Guid.NewGuid():N}.tmp";
        var json = JsonSerializer.Serialize(identity, JsonOptions);

        try
        {
            File.WriteAllText(tempPath, json, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
            File.Move(tempPath, _stateFilePath, overwrite: true);
        }
        finally
        {
            if (File.Exists(tempPath))
                File.Delete(tempPath);
        }
    }
}