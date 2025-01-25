ACPI（Advanced Configuration and Power Interface，高级配置与电源接口）表是一种数据结构，用于描述计算机硬件的配置信息以及电源管理的策略。ACPI 规范由 Intel 和其他硬件厂商共同制定，旨在提供一个统一的方式来管理硬件设备、配置系统资源和进行电源管理。ACPI 表是 ACPI 规范的核心部分，它们为操作系统提供了关键的硬件信息和控制功能。

### 主要 ACPI 表的类型和作用

1. **`RSDP`（Root System Description Pointer）**：
   - 指向 ACPI 表的根描述符，提供 ACPI 表的起始位置及其版本信息。
2. **`RSDT`（Root System Description Table）**：
   - 包含指向其他 ACPI 表的指针。RSDT 是系统的 ACPI 表目录，描述了系统中所有其他 ACPI 表的位置。
3. **`XSDT`（Extended System Description Table）**：
   - 类似于 RSDT，但使用 64 位地址，可以处理大于 4 GB 的地址空间。XSDT 也是 ACPI 表目录的一部分，提供了更大的地址范围支持。
4. **`DSDT`（Differentiated System Description Table）**：
   - 描述了系统的硬件配置、设备、功能和其他配置信息。DSDT 主要用于操作系统获取硬件信息和配置。
5. **`SSDT`（Secondary System Description Table）**：
   - 附加的系统描述表，用于扩展 DSDT，包含额外的硬件信息或修改。SSDT 可以有多个，用于补充或修改 DSDT 中的定义。
6. **`FADT`（Fixed ACPI Description Table）**：
   - 描述 ACPI 固定数据结构的详细信息，例如系统的电源管理、静态数据和操作方法。FADT 还包含系统支持的电源管理功能的信息。
7. **`APIC`（Advanced Programmable Interrupt Controller Table）**：
   - 描述系统的中断控制器结构，用于中断管理。
8. **`MADT`（Multiple APIC Description Table）**：
   - 描述系统中多个 APIC 的信息，用于中断管理和处理器的调度。
9. **`HPET`（High Precision Event Timer Table）**：
   - 描述高精度事件定时器的信息，用于实现高精度的定时和计时功能。
10. **`SRAT`（System Resource Affinity Table）**：
    - 描述系统资源的亲和性，例如 CPU 和内存的关系，用于优化资源分配。

### 作用

- **硬件描述**：ACPI 表提供了对系统硬件的详细描述，使操作系统能够理解和配置硬件设备。
- **电源管理**：通过 ACPI 表，操作系统可以管理电源状态，执行休眠、待机和关机操作。
- **设备配置**：ACPI 表允许操作系统配置设备、设置中断和资源分配，确保硬件设备正常工作。
- **兼容性**：ACPI 提供了统一的接口，使得操作系统和硬件之间的交互更加一致和兼容。

### 读取和解析

操作系统通过 BIOS 或 UEFI 固件在启动时加载 ACPI 表。这些表通常存储在系统的内存中，操作系统会解析这些表来获取系统硬件信息和配置参数。操作系统的 ACPI 驱动程序会使用这些信息来进行硬件初始化、电源管理和设备配置。

### 总结

ACPI 表是 ACPI 规范中的核心数据结构，提供了系统硬件的详细描述和电源管理功能。通过这些表，操作系统可以有效地管理硬件设备、配置资源和进行电源管理，以提高系统的性能和兼容性。