@echo off
REM Drag Power BI files, Excel/CSV files or whole folders onto this icon.
REM Everything is processed on this PC with networking disabled.
REM Results are saved next to the files you dropped:
REM   .pbix/.pbit  -> <name>_pbi_report_<time>.xlsx
REM   Excel/CSV    -> <name>_profile_<time>.xlsx
REM   Folder       -> _profile_<time>.xlsx and _combined_<time>.xlsx inside the folder
if "%~1"=="" (
  echo Drag files or a folder onto this icon to process them.
  pause
  exit /b
)
python "%~dp0bi_toolkit.py" auto %*
echo.
echo Done. Results were saved next to the files you dropped.
pause
