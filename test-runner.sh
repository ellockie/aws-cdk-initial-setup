#!/bin/bash

echo "Running AWS Budget Alarms Stack Tests..."
echo "======================================="

# Run specific test suites
echo "1. Testing Default Configuration..."
npx jest --testNamePattern="Default Configuration" --verbose

echo -e "\n2. Testing Custom Configuration..."
npx jest --testNamePattern="Custom Configuration" --verbose

echo -e "\n3. Testing Environment Variable Handling..."
npx jest --testNamePattern="Environment Variable Handling" --verbose

echo -e "\n4. Running full test suite..."
npm test
