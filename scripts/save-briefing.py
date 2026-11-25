#!/usr/bin/env python3
"""老王数据看板 · 早报归档写入工具（只在 VPS 宿主机上跑，零依赖）。

用法：
  python3 scripts/save-briefing.py add <issue-json-file>   # 按日期幂等写入一期简报
  python3 scripts/save-briefing.py remove <YYYY-MM-DD>      # 删除某一期（测试清理用）
  python3 scripts/save-briefing.py list                     # 列出已存档的日期

数据文件：<仓库根目录>/data/briefings.json（git 不提交；容器通过 ./data 挂载直接读到）。
issue JSON 形状：
  {"date": "2026-11-25", "title": "早间简报 · 11 月 25 日 星期三",
   "sections": [{"heading": "三台 VPS：全部在线", "lines": ["……", "……"]}, ...]}
同一日期已存在时 add 直接跳过（返回 0，不重复、不覆盖）。
写入是原子的（写临时文件再改名），不会写坏已有归档。
"""

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / 'data' / 'briefings.json'
DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')


def load():
    try:
        data = json.loads(DATA_FILE.read_text(encoding='utf-8'))
        if isinstance(data, dict) and isinstance(data.get('issues'), list):
            return data['issues']
    except FileNotFoundError:
        pass
    except Exception as e:
        print(f'briefings.json 损坏，无法读取：{e}', file=sys.stderr)
        sys.exit(2)
    return []


def save(issues):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = DATA_FILE.with_suffix('.json.tmp')
    tmp.write_text(
        json.dumps({'issues': issues}, ensure_ascii=False, indent=1) + '\n',
        encoding='utf-8',
    )
    tmp.replace(DATA_FILE)


def valid_issue(it):
    if not isinstance(it, dict):
        return 'issue 不是对象'
    if not DATE_RE.match(str(it.get('date') or '')):
        return 'date 必须是 YYYY-MM-DD'
    if not isinstance(it.get('title'), str) or not it['title'].strip():
        return 'title 缺失'
    if not isinstance(it.get('sections'), list) or not it['sections']:
        return 'sections 必须是带内容的列表'
    for s in it['sections']:
        if (
            not isinstance(s, dict)
            or not isinstance(s.get('heading'), str)
            or not isinstance(s.get('lines'), list)
        ):
            return 'section 形状不对（需要 heading + lines）'
    return None


def cmd_add(path):
    try:
        issue = json.loads(Path(path).read_text(encoding='utf-8'))
    except Exception as e:
        print(f'读取 issue 文件失败：{e}', file=sys.stderr)
        return 2
    err = valid_issue(issue)
    if err:
        print(f'issue 无效：{err}', file=sys.stderr)
        return 2
    issues = load()
    if any(i.get('date') == issue['date'] for i in issues):
        print(f"{issue['date']} 已归档，跳过（不重复）")
        return 0
    issues.append(issue)
    issues.sort(key=lambda i: i.get('date', ''), reverse=True)
    save(issues)
    print(f"已归档 {issue['date']}（共 {len(issues)} 期）")
    return 0


def cmd_remove(date):
    issues = load()
    kept = [i for i in issues if i.get('date') != date]
    if len(kept) == len(issues):
        print(f'{date} 不在归档里')
        return 0
    save(kept)
    print(f'已删除 {date}（剩 {len(kept)} 期）')
    return 0


def cmd_list():
    for i in load():
        print(i.get('date'), '|', i.get('title', ''))
    return 0


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(2)
    cmd = sys.argv[1]
    if cmd == 'add' and len(sys.argv) == 3:
        sys.exit(cmd_add(sys.argv[2]))
    if cmd == 'remove' and len(sys.argv) == 3:
        sys.exit(cmd_remove(sys.argv[2]))
    if cmd == 'list' and len(sys.argv) == 2:
        sys.exit(cmd_list())
    print(__doc__)
    sys.exit(2)
