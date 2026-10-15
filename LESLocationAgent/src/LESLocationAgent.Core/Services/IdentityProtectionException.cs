namespace LESLocationAgent.Core.Services;

/// <summary>Fail-closed recovery error. Messages never contain signing material.</summary>
public sealed class IdentityProtectionException(string message) : InvalidOperationException(message);
