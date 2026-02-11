"""
Utility functions for the Noise Pollution Monitoring API.

This module provides helper functions for common operations like ID generation and CSV saving.
"""

import pandas as pd
import os


def generate_id(prefix, dataframe):
    """
    Generate a unique ID with the given prefix.
    
    Args:
        prefix (str): The prefix for the ID (e.g., 'R', 'P', 'D').
        dataframe (pd.DataFrame): The dataframe to count existing records from.
    
    Returns:
        str: The generated ID (e.g., 'R001', 'P002').
    """
    next_id = len(dataframe) + 1
    return f'{prefix}{next_id:03d}'


def save_csv(dataframe, file_path):
    """
    Save a dataframe to a CSV file.
    
    Args:
        dataframe (pd.DataFrame): The dataframe to save.
        file_path (str): The path to save the CSV file.
    """
    dataframe.to_csv(file_path, index=False)


def build_csv_path(data_dir, filename):
    """
    Build the full path for a CSV file in the data directory.
    
    Args:
        data_dir (str): The data directory path.
        filename (str): The CSV filename (e.g., 'plans.csv').
    
    Returns:
        str: The full path to the CSV file.
    """
    return os.path.join(data_dir, filename)
