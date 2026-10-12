@echo off
REM Local BI Toolkit - Windows launcher. Runs offline on this PC only.
REM Usage examples:
REM   run_toolkit.bat pbi "C:\Reports\Sales.pbit"
REM   run_toolkit.bat profile "C:\Data\Monthly"
REM   run_toolkit.bat combine "C:\Data\Monthly" --sheet Sheet1
REM   run_toolkit.bat compare old.xlsx new.xlsx --key InvoiceID
python "%~dp0bi_toolkit.py" %*
pause
