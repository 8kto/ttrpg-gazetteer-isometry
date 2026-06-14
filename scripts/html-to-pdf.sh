#!/bin/bash

# Check if the correct number of arguments is provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <html_directory> <output_pdf_file>"
    exit 1
fi

HTML_DIR="$1"
OUTPUT_PDF="$2"
TEMP_HTML="/tmp/merged_$$.html"

# Verify that the provided directory exists
if [ ! -d "$HTML_DIR" ]; then
    echo "Error: Directory '$HTML_DIR' does not exist."
    exit 1
fi

# Create a basic HTML wrapper in the temporary file
{
    echo "<!DOCTYPE html>"
    echo "<html>"
    echo "<head><meta charset=\"UTF-8\"><title>Merged Document</title></head>"
    echo "<link href="http://127.0.0.1:3000/output.css" rel="stylesheet" />"
    echo "<body>"
} > "$TEMP_HTML"

# Find all HTML files matching the pattern, sorted by name
FILES=$(ls -1v "$HTML_DIR"/*.md.html 2>/dev/null)
if [ -z "$FILES" ]; then
    echo "Error: No HTML files found in '$HTML_DIR' matching pattern '*.md.html'."
    rm -f "$TEMP_HTML"
    exit 1
fi

# Append each HTML file's content to the temporary file
for file in $FILES; do
    cat "$file" >> "$TEMP_HTML"
    echo "" >> "$TEMP_HTML"  # Separate files with a newline
done

# Close the HTML wrapper
{
    echo "</body>"
    echo "</html>"
} >> "$TEMP_HTML"

# Check if the html2pdf command is available
if ! command -v html2pdf >/dev/null 2>&1; then
    echo "Error: html2pdf command not found. Please install it from https://crates.io/crates/html2pdf"
    rm -f "$TEMP_HTML"
    exit 1
fi

# Convert the merged HTML file into a PDF using html2pdf
html2pdf \
  -o "$OUTPUT_PDF"  \
  --margin '0 0 0 0' \
  --header src/html/fragments/header.html \
  --paper A5 "$TEMP_HTML"
#  --wait 3s \

# Check if the PDF was created successfully
if [ $? -eq 0 ]; then
    echo "PDF created successfully: $OUTPUT_PDF"
else
    echo "Error: PDF creation failed."
    rm -f "$TEMP_HTML"
    exit 1
fi

# Clean up the temporary HTML file
rm -f "$TEMP_HTML"
