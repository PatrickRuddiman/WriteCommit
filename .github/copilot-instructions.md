---
applyTo: "**/*.cs"
---
When there are formatting issues detected in the code fix them by running the following command:
```powershell
dotnet csharpier format PATH
```
if csharpier is not installed, install it
```powershell
dotnet tool install -g csharpier
```