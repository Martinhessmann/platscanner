#!/bin/bash

# Create directory if it doesn't exist
mkdir -p public/images/relics

# Define the eras and refinement levels
ERAS=("lith" "meso" "neo" "axi")
REFINEMENTS=("intact" "exceptional" "flawless" "radiant")

# Download all combinations
for era in "${ERAS[@]}"; do
  for refinement in "${REFINEMENTS[@]}"; do
    echo "Downloading ${era}-${refinement}.png..."
    curl -L "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/img/${era}-${refinement}.png" -o "public/images/relics/${era}_${refinement}.png"
  done
done

# Download unknown.png as a fallback
echo "Downloading unknown.png..."
curl -L "https://raw.githubusercontent.com/WFCD/warframe-items/master/data/img/unknown.png" -o "public/images/relics/unknown.png"

echo "All relic images downloaded successfully!"