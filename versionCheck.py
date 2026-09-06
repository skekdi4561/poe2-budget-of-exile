#!/usr/bin/env python3

import json
import re


def extract_version_from_readme():
    with open("README.md", "r") as file:
        content = file.read()
    match = re.search(r"Exiled-Exchange-2-Setup-(\d+\.\d+\.\d+)", content)
    if match:
        return match.group(1)
    return None


def extract_version_from_bug_report():
    with open(".github/ISSUE_TEMPLATE/bug-report.yml", "r") as file:
        for line in file:
            match = re.match(r"^\s*-\s*(\d+\.\d+\.\d+)", line)
            if match:
                return match.group(1)
    return None


def extract_version_from_config():
    with open("docs/.vitepress/config.js", "r") as file:
        content = file.read()
    match = re.search(r"appVersion: \'(\d+\.\d+\.\d+)\'", content)
    if match:
        return match.group(1)
    return None


def extract_version_from_package_json():
    with open("main/package.json", "r") as file:
        package_data: dict[str, str] = json.load(file)  # pyright: ignore[reportAny]
    return package_data["version"]


def extract_version_from_package_lock():
    with open("main/package-lock.json", "r") as file:
        package_lock_data: dict[str, dict[str, dict[str, str]]] = json.load(file)  # pyright: ignore[reportAny]
    top_version = package_lock_data["version"]
    packages_version = package_lock_data["packages"][""]["version"]
    return top_version, packages_version


def main():
    # 이 포크는 원작의 README·이슈 템플릿·docs 를 안 쓴다(파일명·버전 목록이 원작 것이라
    # 비교하면 **항상 실패**하고, 그러면 게이트가 죽어 진짜 드리프트를 아무도 못 잡는다 —
    # 실제로 main/package-lock.json 이 v1.0.0~v1.1.0 내내 0.1.0 으로 방치됐다).
    # 배포물에 실제로 실리는 두 곳만 본다.
    package_json_version = extract_version_from_package_json()
    lock_top, lock_packages = extract_version_from_package_lock()

    if package_json_version != lock_top or package_json_version != lock_packages:
        print("Version mismatch:")
        print(f"  main/package.json           : {package_json_version}")
        print(f"  main/package-lock.json      : {lock_top}")
        print(f'  main/package-lock packages[""]: {lock_packages}')
        print("Run `npm install --package-lock-only` in ./main after bumping the version.")
        raise SystemExit(1)

    print(f"Version OK: {package_json_version}")


if __name__ == "__main__":
    main()
