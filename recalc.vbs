Set xlApp = CreateObject("Excel.Application")
xlApp.Visible = False
xlApp.DisplayAlerts = False

On Error Resume Next
Set fso = CreateObject("Scripting.FileSystemObject")
filePath = fso.GetAbsolutePathName("final-test.xlsx")
Set xlBook = xlApp.Workbooks.Open(filePath, , False)

If Not IsEmpty(xlBook) Then
    ' Force calculation
    xlApp.CalculateFullRebuild
    xlApp.Calculate
    
    ' Resave to preserve cached values
    outputPath = fso.GetBaseName(filePath) & "-recalculated." & fso.GetExtensionName(filePath)
    xlBook.SaveAs outputPath
    xlBook.Close
    xlApp.Quit
    
    WScript.Echo "Success: Formulas recalculated and cached"
Else
    WScript.Echo "Failed to open file"
    xlApp.Quit
End If

Set xlBook = Nothing
Set xlApp = Nothing
