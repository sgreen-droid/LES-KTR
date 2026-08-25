using FluentAssertions;
using LESLocationAgent.Core.Helpers;
using Xunit;

namespace LESLocationAgent.Tests;

public sealed class StartupDiagnosticClassifierTests
{
    [Fact]
    public void Classify_WhenXamlDllIsMissing_ExplainsThatTheMsiMustBeReinstalled()
    {
        var result = StartupDiagnosticClassifier.Classify(Evidence(XamlDllExists: false));

        result.FailureKind.Should().Be(StartupFailureKind.MissingPackagedXamlDll);
        result.IsSpecific.Should().BeTrue();
        result.RecommendedAction.Should().Contain("Reinstall");
    }

    [Fact]
    public void Classify_WhenPackagedAppRuntimeDllIsMissing_ExplainsThatTheMsiMustBeReinstalled()
    {
        var result = StartupDiagnosticClassifier.Classify(
            Evidence(WindowsAppRuntimeDllExists: false));

        result.FailureKind.Should().Be(StartupFailureKind.MissingPackagedWindowsAppRuntimeDll);
        result.IsSpecific.Should().BeTrue();
        result.RecommendedAction.Should().Contain("Reinstall");
    }

    [Theory]
    [InlineData(StartupDiagnosticClassifier.ErrorBadExeFormat)]
    [InlineData(StartupDiagnosticClassifier.ErrorExeMachineTypeMismatch)]
    public void Classify_WhenWindowsReportsALoaderFormatMismatch_DoesNotOverstateWhichBinaryIsWrong(int errorCode)
    {
        var result = StartupDiagnosticClassifier.Classify(
            Evidence(NativeLoaderErrorCode: errorCode));

        result.FailureKind.Should().Be(StartupFailureKind.NativeDependencyLoadFailure);
        result.IsSpecific.Should().BeFalse();
    }

    [Fact]
    public void Classify_WhenModuleIsMissingAndVisualCppIsNotDetected_DoesNotClaimVisualCppIsTheCause()
    {
        var result = StartupDiagnosticClassifier.Classify(
            Evidence(
                VisualCppRuntimeDetected: false,
                NativeLoaderErrorCode: StartupDiagnosticClassifier.ErrorModuleNotFound));

        result.FailureKind.Should().Be(StartupFailureKind.NativeDependencyLoadFailure);
        result.RecommendedAction.Should().Contain("Visual C++");
        result.IsSpecific.Should().BeFalse();
    }

    [Fact]
    public void Classify_WhenWindowsDoesNotNameTheMissingNativeDependency_DoesNotGuess()
    {
        var result = StartupDiagnosticClassifier.Classify(
            Evidence(NativeLoaderErrorCode: StartupDiagnosticClassifier.ErrorModuleNotFound));

        result.FailureKind.Should().Be(StartupFailureKind.NativeDependencyLoadFailure);
        result.IsSpecific.Should().BeFalse();
        result.Summary.Should().Contain("native dependencies");
    }

    [Fact]
    public void Classify_WhenTheXamlStartupCheckFails_ReportsTheCheckResultWithoutInventingACause()
    {
        var result = StartupDiagnosticClassifier.Classify(
            Evidence(XamlRequirementsSatisfied: false));

        result.FailureKind.Should().Be(StartupFailureKind.WindowsAppSdkRequirementsFailed);
        result.IsSpecific.Should().BeFalse();
        result.Summary.Should().Contain("did not complete successfully");
    }

    [Fact]
    public void Classify_WhenTheXamlStartupExportIsMissing_ReportsAnIncompleteOrIncompatibleXamlRuntime()
    {
        var result = StartupDiagnosticClassifier.Classify(
            Evidence(XamlRequirementsExportErrorCode: 127));

        result.FailureKind.Should().Be(StartupFailureKind.MissingXamlRequirementsExport);
        result.IsSpecific.Should().BeTrue();
        result.RecommendedAction.Should().Contain("Reinstall");
    }

    [Fact]
    public void Classify_WhenAllPreflightChecksPass_DoesNotReportAFailure()
    {
        var result = StartupDiagnosticClassifier.Classify(
            Evidence(XamlRequirementsSatisfied: true));

        result.FailureKind.Should().Be(StartupFailureKind.None);
        result.Summary.Should().Contain("passed");
    }

    [Fact]
    public void Classify_WhenReadinessPassesButPackagedRuntimeFileIsMissing_PrioritizesTheMissingFile()
    {
        var result = StartupDiagnosticClassifier.Classify(
            Evidence(
                WindowsAppRuntimeDllExists: false,
                XamlRequirementsSatisfied: true));

        result.FailureKind.Should().Be(StartupFailureKind.MissingPackagedWindowsAppRuntimeDll);
    }

    [Fact]
    public void Classify_WhenReadinessPassesButXamlArchitectureIsNotX64_PrioritizesArchitecture()
    {
        var result = StartupDiagnosticClassifier.Classify(
            Evidence(
                XamlDllArchitecture: "x86",
                XamlRequirementsSatisfied: true));

        result.FailureKind.Should().Be(StartupFailureKind.IncompatibleArchitecture);
    }

    private static StartupDiagnosticEvidence Evidence(
        bool XamlDllExists = true,
        bool WindowsAppRuntimeDllExists = true,
        string XamlDllArchitecture = "x64",
        bool Is64BitProcess = true,
        bool Is64BitOperatingSystem = true,
        bool VisualCppRuntimeDetected = true,
        int? NativeLoaderErrorCode = null,
        int? XamlRequirementsExportErrorCode = null,
        bool? XamlRequirementsSatisfied = null) =>
        new(
            XamlDllExists,
            WindowsAppRuntimeDllExists,
            XamlDllArchitecture,
            Is64BitProcess,
            Is64BitOperatingSystem,
            VisualCppRuntimeDetected,
            NativeLoaderErrorCode,
            NativeLoaderErrorMessage: null,
            XamlRequirementsExportErrorCode,
            XamlRequirementsExportErrorMessage: null,
            XamlRequirementsSatisfied);
}