' LES Location Agent — Uninstall Password Check
' Called as a WiX custom action during the UI sequence when REMOVE="ALL".
' Prompts for the uninstall password. Raises an error to abort if wrong.
Function CheckUninstallPassword()
    Dim sPassword
    sPassword = InputBox( _
        "Enter the LES Location Agent uninstall password:" & vbCrLf & _
        "(Contact your IT administrator if you do not have this password.)", _
        "LES Location Agent - Uninstall Protection")

    ' Empty string means user pressed Cancel
    If sPassword = "" Or sPassword <> "UnInStAlL" Then
        MsgBox "Incorrect password. The uninstall has been cancelled.", _
               vbCritical, "LES Location Agent"
        ' Raise an error — MSI treats this as a custom action failure and aborts
        Err.Raise vbObjectError + 512, "LES Location Agent", _
                  "Uninstall cancelled: incorrect password."
    End If

    CheckUninstallPassword = 0
End Function
