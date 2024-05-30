#!/bin/bash

# Path to the TypeScript test file
file_path="example/src/tests/groupTests.ts"

# Temporary file to store intermediate results
temp_file=$(mktemp)

# Counter for test numbers
test_number=1

# Process the file
awk -v test_num="$test_number" '
    # Match lines that start with "test(" and are function declarations
    /^test\(.*\)/ {
        # Check if the previous line is a test number comment
        if (prev_line ~ /^\/\/ Test [0-9]+$/) {
            # Replace the number in the existing comment
            sub(/[0-9]+$/, test_num, prev_line)
            print prev_line
        } else {
            # Print a new test number comment
            print "// Test " test_num
        }
        test_num++
    }
    # Store the current line in prev_line before printing
    { prev_line = $0; if (!/^\/\/ Test [0-9]+$/) print }
' "$file_path" > "$temp_file"

# Move the temporary file to the original file
mv "$temp_file" "$file_path"

# Remove the temporary file if needed (optional, as mv already moved it)
rm -f "$temp_file"

echo "Updated test numbers in $file_path"
