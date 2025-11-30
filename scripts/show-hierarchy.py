#!/usr/bin/env python3
"""Display financial codes hierarchy as a tree diagram"""

import psycopg2
import os
from dotenv import load_dotenv
from collections import defaultdict

load_dotenv('.env.local')
DATABASE_URL = os.getenv('DATABASE_URL')
# Remove schema parameter (Prisma-specific) for psycopg2
if '?schema=' in DATABASE_URL:
    DATABASE_URL = DATABASE_URL.split('?')[0]

def build_tree(codes):
    """Build a tree structure from flat list of codes"""
    # Create lookup by uuid
    by_uuid = {code['uuid']: code for code in codes}
    
    # Build children relationships
    children = defaultdict(list)
    roots = []
    
    for code in codes:
        if code['parent_uuid'] and code['parent_uuid'] in by_uuid:
            children[code['parent_uuid']].append(code)
        else:
            roots.append(code)
    
    # Custom sort function for codes starting with "0"
    def sort_key(code):
        c = code['code']
        first_part = c.split('.')[0] if '.' in c else c
        if first_part.startswith('0'):
            return '~' + c  # Sort after "9"
        return c
    
    # Sort children
    for parent_uuid in children:
        children[parent_uuid].sort(key=sort_key)
    
    roots.sort(key=sort_key)
    
    return roots, children, by_uuid

def print_tree(node, children, level=0, prefix="", is_last=True):
    """Recursively print tree structure"""
    # Determine the connector
    connector = "└── " if is_last else "├── "
    
    # Print current node
    if level == 0:
        print(f"{node['code']} - {node['name']}")
    else:
        print(f"{prefix}{connector}{node['code']} - {node['name']}")
    
    # Get children of current node
    node_children = children.get(node['uuid'], [])
    
    # Print children
    for i, child in enumerate(node_children):
        is_last_child = (i == len(node_children) - 1)
        
        if level == 0:
            child_prefix = ""
        else:
            child_prefix = prefix + ("    " if is_last else "│   ")
        
        print_tree(child, children, level + 1, child_prefix, is_last_child)

def main():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()
    
    try:
        # Fetch all codes
        cur.execute("""
            SELECT uuid, code, name, parent_uuid, sort_order, depth
            FROM financial_codes
            ORDER BY depth, sort_order, code
        """)
        
        codes = []
        for row in cur.fetchall():
            codes.append({
                'uuid': row[0],
                'code': row[1],
                'name': row[2],
                'parent_uuid': row[3],
                'sort_order': row[4],
                'depth': row[5]
            })
        
        print(f"\nFinancial Codes Hierarchy ({len(codes)} total codes)\n")
        print("=" * 80)
        print()
        
        # Build and print tree
        roots, children, by_uuid = build_tree(codes)
        
        for i, root in enumerate(roots):
            print_tree(root, children, 0, "", i == len(roots) - 1)
            if i < len(roots) - 1:
                print()  # Blank line between root trees
        
        print()
        print("=" * 80)
        
        # Statistics
        max_depth = max(code['depth'] for code in codes)
        depth_counts = defaultdict(int)
        for code in codes:
            depth_counts[code['depth']] += 1
        
        print(f"\nStatistics:")
        print(f"  Total codes: {len(codes)}")
        print(f"  Maximum depth: {max_depth}")
        print(f"  Root nodes: {len(roots)}")
        print(f"\n  By depth:")
        for depth in sorted(depth_counts.keys()):
            print(f"    Level {depth}: {depth_counts[depth]} codes")
        
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    main()
