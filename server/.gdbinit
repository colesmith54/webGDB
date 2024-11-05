python
import sys
import os

pretty_printers_path = f'/usr/share/gcc/python'

if os.path.exists(pretty_printers_path):
    sys.path.insert(0, pretty_printers_path)
    from libstdcxx.v6.printers import register_libstdcxx_printers
    register_libstdcxx_printers(gdb)
end

set pagination off

set auto-load safe-path /
