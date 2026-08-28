import tkinter as tk
from tkinter import filedialog, messagebox, ttk, scrolledtext
import json
import uuid
import zlib
import base64
import hashlib
import time
import os
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad, unpad

class UMCMigrator:
    def __init__(self, master):
        self.master = master
        master.title("UMC 1.5 → 2.0 迁移工具")
        master.geometry("650x550")
        master.resizable(True, True)

        # 输入文件
        ttk.Label(master, text="1.5 文件路径:").grid(row=0, column=0, padx=10, pady=10, sticky="w")
        self.input_path = tk.StringVar()
        ttk.Entry(master, textvariable=self.input_path, width=45).grid(row=0, column=1, padx=5, sticky="ew")
        ttk.Button(master, text="浏览...", command=self.select_input).grid(row=0, column=2, padx=5)

        # 用户名（2.0 备份所有者）
        ttk.Label(master, text="用户名:").grid(row=1, column=0, padx=10, pady=10, sticky="w")
        self.username = tk.StringVar()
        ttk.Entry(master, textvariable=self.username, width=45).grid(row=1, column=1, columnspan=2, padx=5, sticky="ew")

        # 旧版主密码（用于解密 1.5 数据）
        ttk.Label(master, text="旧版主密码:").grid(row=2, column=0, padx=10, pady=10, sticky="w")
        self.old_password = tk.StringVar()
        ttk.Entry(master, textvariable=self.old_password, width=45, show="*").grid(row=2, column=1, columnspan=2, padx=5, sticky="ew")

        # 新版主密码（用于加密 2.0 数据）
        ttk.Label(master, text="新版主密码:").grid(row=3, column=0, padx=10, pady=10, sticky="w")
        self.new_password = tk.StringVar()
        ttk.Entry(master, textvariable=self.new_password, width=45, show="*").grid(row=3, column=1, columnspan=2, padx=5, sticky="ew")

        # 输出文件
        ttk.Label(master, text="2.0 输出路径:").grid(row=4, column=0, padx=10, pady=10, sticky="w")
        self.output_path = tk.StringVar()
        ttk.Entry(master, textvariable=self.output_path, width=45).grid(row=4, column=1, padx=5, sticky="ew")
        ttk.Button(master, text="浏览...", command=self.select_output).grid(row=4, column=2, padx=5)

        # 迁移按钮
        self.migrate_btn = ttk.Button(master, text="开始迁移", command=self.migrate)
        self.migrate_btn.grid(row=5, column=0, columnspan=3, pady=10)

        # 状态栏
        self.status = tk.StringVar()
        self.status.set("就绪")
        ttk.Label(master, textvariable=self.status, relief="sunken").grid(row=6, column=0, columnspan=3, sticky="we", padx=10, pady=5)

        # 日志区域
        ttk.Label(master, text="日志:").grid(row=7, column=0, padx=10, pady=(10,0), sticky="w")
        self.log_text = scrolledtext.ScrolledText(master, width=75, height=15, state='disabled', wrap=tk.WORD)
        self.log_text.grid(row=8, column=0, columnspan=3, padx=10, pady=5, sticky="nsew")

        master.grid_rowconfigure(8, weight=1)
        master.grid_columnconfigure(1, weight=1)

    def log(self, message):
        self.log_text.configure(state='normal')
        self.log_text.insert(tk.END, message + "\n")
        self.log_text.see(tk.END)
        self.log_text.configure(state='disabled')
        self.master.update_idletasks()

    def select_input(self):
        path = filedialog.askopenfilename(filetypes=[("UMC files", "*.umc"), ("All files", "*.*")])
        if path:
            self.input_path.set(path)

    def select_output(self):
        path = filedialog.asksaveasfilename(defaultextension=".umc", filetypes=[("UMC files", "*.umc")])
        if path:
            self.output_path.set(path)

    def migrate(self):
        # 清空日志
        self.log_text.configure(state='normal')
        self.log_text.delete('1.0', tk.END)
        self.log_text.configure(state='disabled')

        # 输入验证
        if not self.input_path.get():
            messagebox.showerror("错误", "请选择输入文件"); self.log("错误：未选择输入文件"); return
        if not self.username.get():
            messagebox.showerror("错误", "请输入用户名"); self.log("错误：未输入用户名"); return
        if not self.old_password.get():
            messagebox.showerror("错误", "请输入旧版主密码"); self.log("错误：未输入旧版主密码"); return
        if not self.new_password.get():
            messagebox.showerror("错误", "请输入新版主密码"); self.log("错误：未输入新版主密码"); return
        if not self.output_path.get():
            messagebox.showerror("错误", "请选择输出文件路径"); self.log("错误：未选择输出文件路径"); return

        self.status.set("正在转换...")
        self.log("开始迁移...")
        self.log(f"输入文件: {self.input_path.get()}")
        self.log(f"输出文件: {self.output_path.get()}")

        try:
            with open(self.input_path.get(), 'r', encoding='utf-8') as f:
                old_data = json.load(f)
            self.log("文件读取成功，JSON 解析完成")
        except Exception as e:
            messagebox.showerror("错误", f"读取文件失败: {e}")
            self.log(f"错误：读取文件失败 - {e}")
            self.status.set("读取失败")
            return

        if old_data.get("version") != "1.5":
            messagebox.showerror("错误", "仅支持 UMC 1.5 版本文件")
            self.log(f"错误：文件版本为 {old_data.get('version')}，不支持")
            self.status.set("版本不匹配")
            return

        self.log(f"文件版本: {old_data.get('version')}，开始转换")
        try:
            new_data = self.convert_to_2_0(old_data, self.username.get(),
                                           self.new_password.get(), self.old_password.get())
            self.log("数据转换完成")
        except Exception as e:
            messagebox.showerror("错误", f"转换失败: {e}")
            self.log(f"错误：转换失败 - {e}")
            self.status.set("转换失败")
            return

        try:
            with open(self.output_path.get(), 'w', encoding='utf-8') as f:
                json.dump(new_data, f, ensure_ascii=False, indent=2)
            self.status.set("转换成功！")
            self.log("文件写入成功")
            self.log("迁移完成！")
            messagebox.showinfo("成功", "迁移完成！")
        except Exception as e:
            messagebox.showerror("错误", f"写入文件失败: {e}")
            self.log(f"错误：写入文件失败 - {e}")
            self.status.set("写入失败")

    # 旧版 PBKDF2（与 CryptoJS.PBKDF2 一致）
    def _pbkdf2(self, password, salt, iterations=10, dklen=32):
        return hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), iterations, dklen).hex()

    # 旧版 AES 解密（OpenSSL 兼容）
    def _aes_decrypt_openssl(self, ciphertext_b64, passphrase):
        try:
            raw = base64.b64decode(ciphertext_b64)
            if raw[:8] != b"Salted__":
                raise ValueError("不是 OpenSSL 格式")
            salt = raw[8:16]
            ct = raw[16:]
            key, iv = self._evp_bytes_to_key(passphrase, salt, 32, 16)
            cipher = AES.new(key, AES.MODE_CBC, iv)
            pt = unpad(cipher.decrypt(ct), AES.block_size)
            return pt.decode('utf-8')
        except Exception:
            return None  # 解密失败返回 None，外部可回退为明文

    # EVP_BytesToKey（MD5，迭代1次）
    def _evp_bytes_to_key(self, password, salt, key_len, iv_len):
        password_bytes = password.encode('utf-8')
        d = b''
        d_i = b''
        while len(d) < key_len + iv_len:
            d_i = hashlib.md5(d_i + password_bytes + salt).digest()
            d += d_i
        return d[:key_len], d[key_len:key_len+iv_len]

    def convert_to_2_0(self, old, username, new_master_password, old_master_password):
        # 获取 salt 并计算 enc
        salt = old.get("salt", "")
        if not salt:
            self.log("警告：文件中无 salt，可能为未加密的旧版本？")
            enc = old_master_password  # fallback
        else:
            enc = self._pbkdf2(old_master_password, salt)
        self.log("已计算解密密钥 (PBKDF2)")

        # 解密函数：先尝试AES解密，失败则返回原始值（可能已是明文）
        def dec(field_value):
            if field_value is None:
                return None
            if isinstance(field_value, str):
                decrypted = self._aes_decrypt_openssl(field_value, enc)
                return decrypted if decrypted is not None else field_value
            else:
                return field_value

        self.log("开始构建文件夹结构（解密）...")
        folders = old.get("folder", [])
        folder_map = {}  # name -> {name, parent, moDate, path}

        # 先收集所有非删除、非根、非回收站的文件夹
        for folder in folders:
            if folder.get("rmDate") is not None:
                continue
            name = dec(folder.get("name"))
            if name in (None, "", ":", "~"):  # 跳过根和回收站
                continue
            parent = dec(folder.get("parent"))
            if parent is None:
                parent = ""  # 父为空字符串
            # 解密 moDate
            mo_date_enc = folder.get("moDate")
            if isinstance(mo_date_enc, str):
                mo_date_str = dec(mo_date_enc) or ""
                try:
                    mo_date = int(mo_date_str)
                except:
                    mo_date = int(time.time() * 1000)
            else:
                mo_date = mo_date_enc if isinstance(mo_date_enc, int) else int(time.time() * 1000)

            folder_map[name] = {
                "name": name,
                "parent": parent,
                "moDate": mo_date
            }

        # 生成文件夹路径（递归，处理 parent 为 ":" 或空字符串表示根）
        folder_paths = {}
        def get_folder_path(name, visited=None):
            if name in folder_paths:
                return folder_paths[name]
            if visited is None:
                visited = set()
            if name in visited:
                path = "/" + name + "/"
                folder_paths[name] = path
                return path
            visited.add(name)

            folder = folder_map.get(name)
            if not folder:
                path = "/" + name + "/"
            else:
                parent = folder.get("parent")
                if not parent or parent in (":", "/", ":/"):
                    parent_path = "/"
                elif parent.startswith(":"):
                    rel = parent[1:]
                    if not rel.startswith("/"):
                        rel = "/" + rel
                    if not rel.endswith("/"):
                        rel += "/"
                    parent_path = rel
                else:
                    parent_path = get_folder_path(parent, visited)
                path = parent_path + name + "/"
            folder_paths[name] = path
            return path

        for name in folder_map:
            get_folder_path(name)

        # 生成 2.0 folders 数组（先添加根节点）
        new_folders = [
            {
                "id": "root",
                "path": "/",
                "name": "/",
                "createdAt": int(time.time() * 1000),
                "updatedAt": int(time.time() * 1000)
            }
        ]

        for name, folder in folder_map.items():
            new_folders.append({
                "id": str(uuid.uuid4()),
                "path": folder_paths[name],
                "name": name,
                "createdAt": folder["moDate"],
                "updatedAt": folder["moDate"]
            })

        self.log(f"文件夹转换完成，共 {len(new_folders)} 个文件夹（含根节点）")

        self.log("开始构建密码条目（解密）...")
        items = []
        passwords = old.get("pwd", [])
        for pwd in passwords:
            if pwd.get("rmDate") is not None:
                continue

            # 解密各字段
            uname = dec(pwd.get("uname")) or ""
            password_val = dec(pwd.get("pwd")) or ""
            email = dec(pwd.get("email")) or ""
            phone = dec(pwd.get("phone")) or ""
            from_val = dec(pwd.get("from")) or ""
            dir_field = dec(pwd.get("dir")) or ""

            # 解密 moDate
            mo_date_enc = pwd.get("moDate")
            if isinstance(mo_date_enc, str):
                mo_date_str = dec(mo_date_enc) or ""
                try:
                    mo_date = int(mo_date_str)
                except:
                    mo_date = int(time.time() * 1000)
            else:
                mo_date = mo_date_enc if isinstance(mo_date_enc, int) else int(time.time() * 1000)

            # 确定父目录路径（新版格式）
            if not dir_field or dir_field in (":", "/", ":/"):
                parent_path = "/"
            elif dir_field.startswith(":"):
                rel = dir_field[1:]
                if not rel.startswith("/"):
                    rel = "/" + rel
                if not rel.endswith("/"):
                    rel += "/"
                parent_path = rel
            else:
                # 可能是文件夹名或相对路径
                parts = dir_field.strip("/").split("/")
                current = "/"
                for part in parts:
                    if part in folder_paths:
                        current = folder_paths[part]
                    else:
                        current += part + "/"
                parent_path = current if current.endswith("/") else current + "/"

            title = from_val or uname or "未命名"
            filename = title.replace("/", "_") + ".pwd"
            item_path = parent_path + filename

            password_data = {
                "username": uname,
                "password": password_val,
                "remark": "",
                "phone": phone,
                "email": email,
                "url": from_val,
                "thirdPartyLogins": []
            }

            items.append({
                "id": str(uuid.uuid4()),
                "path": item_path,
                "title": title,
                "type": "password",
                "data": password_data,
                "createdAt": mo_date,
                "updatedAt": mo_date
            })

        self.log(f"密码条目转换完成，共 {len(items)} 条")

        vault_data = {
            "data": {
                "items": items,
                "folders": new_folders
            }
        }

        self.log("开始加密数据（2.0 格式）...")
        encrypted_data = self.encrypt_data_2_0(json.dumps(vault_data, ensure_ascii=False), new_master_password)
        self.log("数据加密完成")

        new_umc = {
            "app": "password-keeper",
            "version": "2.0",
            "username": username,
            "createdAt": int(time.time() * 1000),
            "data": encrypted_data
        }
        return new_umc

    # 2.0 加密（与 crypto.ts 的 Crypto.stringify 一致）
    def encrypt_data_2_0(self, plaintext, master_password):
        json_bytes = plaintext.encode('utf-8')
        compressed = zlib.compress(json_bytes)
        b64_compressed = base64.b64encode(compressed).decode('ascii')
        payload = "gz:" + b64_compressed
        passphrase = hashlib.sha512(master_password.encode('utf-8')).hexdigest()
        return self._aes_encrypt_openssl(payload, passphrase)

    def _aes_encrypt_openssl(self, plaintext, passphrase):
        salt = os.urandom(8)
        key, iv = self._evp_bytes_to_key(passphrase, salt, 32, 16)
        cipher = AES.new(key, AES.MODE_CBC, iv)
        ct_bytes = cipher.encrypt(pad(plaintext.encode('utf-8'), AES.block_size))
        result = b"Salted__" + salt + ct_bytes
        return base64.b64encode(result).decode('ascii')

def main():
    root = tk.Tk()
    app = UMCMigrator(root)
    root.mainloop()

if __name__ == "__main__":
    main()