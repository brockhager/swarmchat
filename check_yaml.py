import sys
try:
    import yaml
except Exception:
    import subprocess
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'PyYAML'])
import yaml
try:
    yaml.safe_load(open('.github/workflows/release.yml'))
    print('YAML OK')
except Exception as e:
    print('YAML ERR:', e)
