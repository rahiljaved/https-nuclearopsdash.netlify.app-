# Local BI Toolkit

An offline tool that documents Power BI files and automates repetitive Excel
work. It runs on your own laptop, reads files from your own folders, and
writes results back to your own folders.

## What it does

| Command | Input | Output (Excel workbook) |
|---|---|---|
| `pbi` | `.pbix` or `.pbit` | Pages, visuals and the fields each uses, Power Query (M) code, data sources. For `.pbit` files, also tables, columns, DAX measures and relationships. |
| `profile` | An Excel/CSV file or a folder of them | Row counts, blanks, duplicates, distinct values, min/max for every column |
| `combine` | A folder of Excel/CSV files | One stacked table with `source_file` and `source_sheet` columns |
| `compare` | Old and new versions of a file, plus a key column | Changed cells, added rows, removed rows |

> To get full DAX and model documentation from a `.pbix`, open it in Power BI
> Desktop, choose **File > Export > Power BI template**, and run `pbi` on the
> `.pbit` it saves.

## Setup (once)

1. Install Python 3.10+ (or ask IT for the approved build).
2. `pip install -r requirements.txt` (or ask IT to install `pandas` and `openpyxl`).

## Drag and drop (easiest)

Drag `.pbix`/`.pbit` files, Excel/CSV files or a whole folder onto
`drop_files_here.bat`. Results are saved next to the files you dropped:

- Power BI file: `<name>_pbi_report_<time>.xlsx`
- Excel/CSV file: `<name>_profile_<time>.xlsx`
- Folder: `_profile_<time>.xlsx` and `_combined_<time>.xlsx` inside that folder

## Command-line usage

```
python bi_toolkit.py pbi "C:\Reports\Sales.pbit"
python bi_toolkit.py profile "C:\Data\Monthly"
python bi_toolkit.py combine "C:\Data\Monthly" --sheet Sheet1 -o combined.xlsx
python bi_toolkit.py compare jan.xlsx feb.xlsx --key InvoiceID
```

On Windows you can use `run_toolkit.bat` with the same arguments.

---

## Data handling statement (for IT / Information Security)

**Where data is processed:** only on the local machine where the script runs.

**Network access:** none. At startup, `bi_toolkit.py` replaces Python's
socket connect and DNS lookup functions with ones that raise an error
(see the "Offline guarantee" block at the top of the file). This happens
before pandas is imported, so neither the toolkit nor its libraries can
open a network connection while it runs. You can confirm this by running
it with the network disconnected, or by watching it in a firewall or
process monitor.

**Dependencies:** Python's standard library plus `pandas` and `openpyxl`, two
widely used open-source packages. The toolkit has no telemetry, cloud API,
AI service or licence check.

**Files read and written:** only the paths the user passes on the command
line. Output workbooks are saved to the current folder, or to the path given
with `-o`.

**Credentials:** none are stored or used. The `pbi` command reads the file
package only. It does not refresh data or connect to the sources listed
inside the Power BI file.

**How it was built:** the source code was written with an AI coding
assistant (Claude Code) using **synthetic test files only**. No company
data was shared during development. The tool does not contact any AI
service when it runs.

**Review:** the toolkit is a single readable Python file (~250 lines). IT is
welcome to review, scan or sign it before approval.
