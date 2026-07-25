from dulwich.repo import Repo
from dulwich.objects import Blob, Tree, Commit
import os, time

repo_path = r'D:\xy xnyz'
r = Repo(repo_path)

# 收集所有要提交的文件
files_to_add = []
for root, dirs, filenames in os.walk(repo_path):
    # 跳过 .git 目录
    if '.git' in root:
        continue
    for fn in filenames:
        full = os.path.join(root, fn)
        rel = os.path.relpath(full, repo_path).replace('\\', '/')
        files_to_add.append((rel, full))

# 创建blob和tree
tree = Tree()
for rel, full in sorted(files_to_add):
    with open(full, 'rb') as f:
        data = f.read()
    blob = Blob()
    blob.data = data
    r.object_store.add_object(blob)
    # 处理子目录
    parts = rel.split('/')
    if len(parts) == 1:
        tree[parts[0].encode()] = (0o100644, blob.id)
    else:
        # 创建子树
        sub = tree
        for p in parts[:-1]:
            if p.encode() not in sub:
                t = Tree()
                r.object_store.add_object(t)
                sub[p.encode()] = (0o040000, t.id)
                sub = t
            else:
                _, tid = sub[p.encode()]
                sub = r.object_store[tid]
        sub[parts[-1].encode()] = (0o100644, blob.id)
        r.object_store.add_object(sub)

r.object_store.add_object(tree)

# 创建commit
commit = Commit()
commit.tree = tree.id
commit.author = b'xhw8848 <xhw8848@126.com>'
commit.committer = b'xhw8848 <xhw8848@126.com>'
commit.author_time = int(time.time())
commit.commit_time = int(time.time())
commit.author_timezone = 8 * 3600
commit.commit_timezone = 8 * 3600
commit.message = b'Initial commit: World Survival 3D game with PWA support'

r.object_store.add_object(commit)

# 更新HEAD
r.refs[b'HEAD'] = commit.id

print(f'Committed {len(files_to_add)} files')
print(f'Commit: {commit.id.decode()}')
