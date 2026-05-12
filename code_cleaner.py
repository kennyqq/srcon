#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Code Cleaner Agent for SRCON Demo
自动清理开发过程中产生的过程文件、临时文件和中间产物。
保留核心前端代码和必要文档。
"""
import os
import shutil
import sys

# 配置：保留的文件（相对路径）
KEEP_FILES = {
    'AGENTS.md',
    'index.html',
    'assurance.html',
    'css/common.css',
    'css/index.css',
    'css/assurance.css',
    'js/data.js',
    'js/common.js',
    'js/index.js',
    'js/assurance.js',
    'code_cleaner.py',
    '.gitignore',
}

# 配置：保留的目录
KEEP_DIRS = {
    'css',
    'js',
    'js/components',
    'data',
    'input',
    'hld',
    'srcon',
    'story',
    '.git',
}

# 配置：要清理的文件模式
CLEAN_PATTERNS = [
    'generate_*.py',
    'inspect_*.py',
    'validate.js',
    '*.txt',
    '*.xlsx',
    '*.pptx',
    'DEVELOPMENT_PLAN.md',
    'srcon_understanding.md',
    'SRCON_Demo_DataDictionary*',
]

# 配置：要清理的目录
CLEAN_DIRS = [
    'output',
]


def should_keep(rel_path):
    """判断文件是否应该保留"""
    rel_path = rel_path.replace('\\', '/')
    # 检查是否在保留列表中
    if rel_path in KEEP_FILES:
        return True
    # 检查是否在保留目录下
    for keep_dir in KEEP_DIRS:
        if rel_path.startswith(keep_dir + '/'):
            return True
    return False


def clean_project():
    """执行清理"""
    root = os.path.dirname(os.path.abspath(__file__))
    removed_files = []
    removed_dirs = []
    
    # 清理文件
    for item in os.listdir(root):
        item_path = os.path.join(root, item)
        rel_path = os.path.relpath(item_path, root).replace('\\', '/')
        
        if os.path.isfile(item_path):
            if not should_keep(rel_path):
                try:
                    os.remove(item_path)
                    removed_files.append(rel_path)
                except Exception as e:
                    print(f'  [跳过] {rel_path}: {e}')
        
        elif os.path.isdir(item_path):
            if item in CLEAN_DIRS:
                try:
                    shutil.rmtree(item_path)
                    removed_dirs.append(rel_path)
                except Exception as e:
                    print(f'  [跳过] {rel_path}: {e}')
    
    # 输出结果
    print('=' * 50)
    print('Code Cleaner Agent - 清理报告')
    print('=' * 50)
    print(f'\n保留文件数: {len(KEEP_FILES)}')
    print(f'保留目录数: {len(KEEP_DIRS)}')
    print(f'\n已删除文件 ({len(removed_files)}):')
    for f in sorted(removed_files):
        print(f'  - {f}')
    print(f'\n已删除目录 ({len(removed_dirs)}):')
    for d in sorted(removed_dirs):
        print(f'  - {d}/')
    print('\n' + '=' * 50)
    print('清理完成！')
    print('=' * 50)


if __name__ == '__main__':
    # 确认
    if len(sys.argv) > 1 and sys.argv[1] == '--force':
        clean_project()
    else:
        print('Code Cleaner Agent')
        print('此操作将删除所有过程文件和临时文件，只保留核心前端代码。')
        print('用法: python code_cleaner.py --force')
        print('')
        print('将要保留的文件:')
        for f in sorted(KEEP_FILES):
            print(f'  + {f}')
        print('')
        print('将要保留的目录:')
        for d in sorted(KEEP_DIRS):
            print(f'  + {d}/')
