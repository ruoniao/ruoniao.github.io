---
clayout    : post
title     : "记录一次kvm下Windows蓝屏问题"
date      : 2024-12-24
lastupdate: 2024-12-24
categories: kvm,linux
published: true
---

# 现象

在linux kernel5.10中，kvm虚拟机windows在设置了硬件断点进行debug时报蓝屏。

![](/assets/img/kvm_msr/1.png)

kvm log日志：

[12787289.097685] kvm [21277]: vcpu1, guest rIP: 0xfffff80003cd1ae3 vmx_set_msr: BTF|LBR in IA32_DEBUGCTLMSR 0x1, nop

# 解决方式

  临时生效服务器里执行	`echo 1 > /sys/module/kvm/parameters/ignore_msrs `

或者管理libvirt重新加载kvm 模块，rmmod kvm_intel kvm && modprobe kvm ignore_msrs=1

# 问题原因

  在设置硬件断点时，guest虚拟机操作了CR4、DG和msr寄存器。CR4寄存器包含多个位（标志位），每个位控制一个特定的处理器特性或功能，其中第3位是设置是否启用调试扩展，支持 I/O 断点。DG是调试寄存器。msr寄存器主要用于存储和控制与处理器相关的特定硬件状态或功能，在kvm中控制虚拟机的状态和硬件访问权限。

  在设置调试寄存器和msr寄存器时，会通过vm_exit将cpu从non-root mode进入了root mode，内核kvm模块将捕获vm_exit并通过vm_exit的reason进行处理。下面将通过追踪分析，为何会导致蓝屏。

  ```C
  arch/x86/kvm/vmx/vmx.c
      
  /*
   * VMX-specific KVM operations for Intel VT-x support.处理vm_exit的函数handle_exit
   */
  static struct kvm_x86_ops vmx_x86_ops __initdata = {
  	.hardware_unsetup          = hardware_unsetup,          /* 撤销硬件初始化 */
  	.hardware_enable           = hardware_enable,           /* 启用VMX硬件支持 */
  	.hardware_disable          = hardware_disable,          /* 禁用VMX硬件支持 */
  	.cpu_has_accelerated_tpr   = report_flexpriority,       /* 检查加速TPR支持 */
  	.has_emulated_msr          = vmx_has_emulated_msr,      /* 检查模拟MSR支持 */
  
  	.vm_size                   = sizeof(struct kvm_vmx),    /* 虚拟机特定数据的大小 */
  	.vm_init                   = vmx_vm_init,              /* 初始化虚拟机 */
  
  	.vcpu_create               = vmx_create_vcpu,          /* 创建vCPU */
  	.vcpu_free                 = vmx_free_vcpu,            /* 释放vCPU */
  	.vcpu_reset                = vmx_vcpu_reset,           /* 重置vCPU状态 */
  
  	.prepare_guest_switch      = vmx_prepare_switch_to_guest, /* 准备进入客户机 */
  	.vcpu_load                 = vmx_vcpu_load,            /* 加载vCPU状态 */
  	.vcpu_put                  = vmx_vcpu_put,             /* 保存vCPU状态 */
  
  	.update_exception_bitmap   = vmx_update_exception_bitmap, /* 更新异常位图 */
  	.get_msr_feature           = vmx_get_msr_feature,      /* 获取支持的MSR特性 */
  	.get_msr                   = vmx_get_msr,              /* 获取MSR值 */
  	.set_msr                   = vmx_set_msr,              /* 设置MSR值 */
  	.get_segment_base          = vmx_get_segment_base,     /* 获取段基地址 */
  	.get_segment               = vmx_get_segment,          /* 获取段信息 */
  	.set_segment               = vmx_set_segment,          /* 设置段信息 */
  
  	.set_cr0                   = vmx_set_cr0,              /* 设置CR0寄存器 */
  	.is_valid_cr4              = vmx_is_valid_cr4,         /* 验证CR4寄存器值 */
  	.set_cr4                   = vmx_set_cr4,              /* 设置CR4寄存器 */
  
  	.run                       = vmx_vcpu_run,             /* 执行vCPU */
  	.handle_exit               = vmx_handle_exit,          /* 处理VM退出 */
  	...
  };
  
  /* 关键数据结构，vmx_init_ops kvm的一些注册函数*/
  static struct kvm_x86_init_ops vmx_init_ops __initdata = {
  	.cpu_has_kvm_support = cpu_has_kvm_support,
  	.disabled_by_bios = vmx_disabled_by_bios,
  	.check_processor_compatibility = vmx_check_processor_compat,
  	.hardware_setup = hardware_setup,
  	.intel_pt_intr_in_guest = vmx_pt_mode_is_host_guest,
  
  	.runtime_ops = &vmx_x86_ops,
  };
  
  /*
  handle_exit reason对应的不同的处理函数，其中EXIT_REASON_MSR_WRITE是处理蓝屏报错的关键处理函数
  一个函数指针数组，其中每个元素都是指向函数的指针。数组的元素类型是：int (*)(struct kvm_vcpu *vcpu)，
  这表示数组中的每个元素都是一个指向接收 struct kvm_vcpu * 参数并返回 int 类型值的函数的指针
  */
  static int (*kvm_vmx_exit_handlers[])(struct kvm_vcpu *vcpu) = {
  
  	[EXIT_REASON_EXTERNAL_INTERRUPT]      = handle_external_interrupt,  /* 外部中断处理 */
  
  	[EXIT_REASON_IO_INSTRUCTION]          = handle_io,                  /* I/O指令处理 */
  	[EXIT_REASON_CR_ACCESS]               = handle_cr,                  /* CR寄存器访问处理 */
  	[EXIT_REASON_DR_ACCESS]               = handle_dr,                  /* DR寄存器访问处理 */
  	[EXIT_REASON_CPUID]                   = kvm_emulate_cpuid,          /* 模拟CPUID指令 */
  	[EXIT_REASON_MSR_READ]                = kvm_emulate_rdmsr,          /* 模拟读取MSR */
  	[EXIT_REASON_MSR_WRITE]               = kvm_emulate_wrmsr,          /* 模拟写入MSR */
  	[EXIT_REASON_INTERRUPT_WINDOW]        = handle_interrupt_window,    /* 中断窗口处理 */
  	[EXIT_REASON_HLT]                     = kvm_emulate_halt,           /* 模拟HLT指令 */
  	[EXIT_REASON_VMCALL]                  = kvm_emulate_hypercall,      /* 模拟VMCALL指令 */
  };
  
  static int __init vmx_init(void){
      ...
      /* 初始化kvm */ 
  	r = kvm_init(&vmx_init_ops, sizeof(struct vcpu_vmx),
  		     __alignof__(struct vcpu_vmx), THIS_MODULE);
  	if (r)
  		return r;
      ...
  }
  ```

其中kvm_init 调用virt/kvm/kvm_main.c的kvm_init，kvm_init调用hardware_setup,其中对msr寄存器进行操作，msr寄存器主要用于存储和控制与处理器相关的特定硬件状态或功能，在kvm中控制虚拟机的状态和硬件访问权限。

```c
int kvm_arch_hardware_setup(void *opaque)
{
	struct kvm_x86_init_ops *ops = opaque;
	int r;

	rdmsrl_safe(MSR_EFER, &host_efer);

	if (boot_cpu_has(X86_FEATURE_XSAVES))
		rdmsrl(MSR_IA32_XSS, host_xss);
	/* 调用vmx或者svm的hardware_setup */
	r = ops->hardware_setup();
	if (r != 0)
		return r;

	memcpy(&kvm_x86_ops, ops->runtime_ops, sizeof(kvm_x86_ops));
	kvm_ops_static_call_update();

	if (ops->intel_pt_intr_in_guest && ops->intel_pt_intr_in_guest())
		kvm_guest_cbs.handle_intel_pt_intr = kvm_handle_intel_pt_intr;
	perf_register_guest_info_callbacks(&kvm_guest_cbs);

	/* 初始化msr list*/
	kvm_init_msr_list();
	return 0;
}

int kvm_init(void *opaque, unsigned vcpu_size, unsigned vcpu_align,
		  struct module *module)
{
	struct kvm_cpu_compat_check c;
	int r;
	int cpu;
    /* 初始化x86架构,检查bios cpu等特性 */
	r = kvm_arch_init(opaque);
	if (r)
		goto out_fail;

	/*
	 * kvm_arch_init makes sure there's at most one caller
	 * for architectures that support multiple implementations,
	 * like intel and amd on x86.
	 * kvm_arch_init must be called before kvm_irqfd_init to avoid creating
	 * conflicts in case kvm is already setup for another implementation.
	 */
	 
	 /* 初始化中断虚拟化 */
	r = kvm_irqfd_init();
	if (r)
		goto out_irqfd;

	if (!zalloc_cpumask_var(&cpus_hardware_enabled, GFP_KERNEL)) {
		r = -ENOMEM;
		goto out_free_0;
	}
    /* 设置硬件相关 其中通过ops函数指针调用vmx的hardware_setup*/
	r = kvm_arch_hardware_setup(opaque);
	if (r < 0)
		goto out_free_1;

	c.ret = &r;
	c.opaque = opaque;
	/* 检查cpu兼容性 */
	for_each_online_cpu(cpu) {
		smp_call_function_single(cpu, check_processor_compat, &c, 1);
		if (r < 0)
			goto out_free_2;
	}

	r = cpuhp_setup_state_nocalls(CPUHP_AP_KVM_STARTING, "kvm/cpu:starting",
				      kvm_starting_cpu, kvm_dying_cpu);
	if (r)
		goto out_free_2;
	register_reboot_notifier(&kvm_reboot_notifier);

	...

	kvm_init_debug();
    /* 初始化vfio相关 供对直接 I/O 访问硬件设备的支持 */
	r = kvm_vfio_ops_init();
	WARN_ON(r);

	return 0;

out_unreg:
	kvm_async_pf_deinit();
out_free:
	kmem_cache_destroy(kvm_vcpu_cache);
out_free_3:
	unregister_reboot_notifier(&kvm_reboot_notifier);
	cpuhp_remove_state_nocalls(CPUHP_AP_KVM_STARTING);
out_free_2:
	kvm_arch_hardware_unsetup();
out_free_1:
	free_cpumask_var(cpus_hardware_enabled);
out_free_0:
	kvm_irqfd_exit();
out_irqfd:
	kvm_arch_exit();
out_fail:
	return r;
}
EXPORT_SYMBOL_GPL(kvm_init);
```

vmx.c 的设置硬件函数

```c
/*
vmx intel 设置硬件注册函数
*/
static __init int hardware_setup(void){
    ...
    vmx_setup_user_return_msrs();
	/* 设置vmcs配置文件 */
	if (setup_vmcs_config(&vmcs_config, &vmx_capability) < 0)
		return -EIO;
    /* 设置或更新当前支持的 CPU 特性*/
    vmx_set_cpu_caps();
    
	/* 为每个cpu设置vmcs */
	r = alloc_kvm_area();
	if (r)
		nested_vmx_hardware_unsetup();

	/* 设置 host的中断唤醒回调处理函数 */
	kvm_set_posted_intr_wakeup_handler(pi_wakeup_handler);

	return r;
}

struct vmcs_hdr {
	u32 revision_id:31;
	u32 shadow_vmcs:1;
};

struct vmcs {
	struct vmcs_hdr hdr;
	u32 abort;
	char data[];
};


/* 为每个cpu设置vmcs */
static __init int alloc_kvm_area(void)
{
	int cpu;

	for_each_possible_cpu(cpu) {
		struct vmcs *vmcs;

		vmcs = alloc_vmcs_cpu(false, cpu, GFP_KERNEL);
		if (!vmcs) {
			free_kvm_area();
			return -ENOMEM;
		}
		if (static_branch_unlikely(&enable_evmcs))
			vmcs->hdr.revision_id = vmcs_config.revision_id;

		per_cpu(vmxarea, cpu) = vmcs;
	}
	return 0;
}

/* 中断唤醒回调处理函数 */
void pi_wakeup_handler(void)
{
	struct kvm_vcpu *vcpu;
	int cpu = smp_processor_id();

	raw_spin_lock(&per_cpu(blocked_vcpu_on_cpu_lock, cpu));
	list_for_each_entry(vcpu, &per_cpu(blocked_vcpu_on_cpu, cpu),
			blocked_vcpu_list) {
		struct pi_desc *pi_desc = vcpu_to_pi_desc(vcpu);

		if (pi_test_on(pi_desc) == 1)
            /* kick一下cpu */
			kvm_vcpu_kick(vcpu);
	}
	raw_spin_unlock(&per_cpu(blocked_vcpu_on_cpu_lock, cpu));
}

/* kick cpu 函数 */
void kvm_vcpu_kick(struct kvm_vcpu *vcpu)
{
	int me, cpu;

	if (kvm_vcpu_wake_up(vcpu))
		return;

	/*
	 * Note, the vCPU could get migrated to a different pCPU at any point
	 * after kvm_arch_vcpu_should_kick(), which could result in sending an
	 * IPI to the previous pCPU.  But, that's ok because the purpose of the
	 * IPI is to force the vCPU to leave IN_GUEST_MODE, and migrating the
	 * vCPU also requires it to leave IN_GUEST_MODE.
	 */
	me = get_cpu();
	if (kvm_arch_vcpu_should_kick(vcpu)) {
		cpu = READ_ONCE(vcpu->cpu);
		if (cpu != me && (unsigned)cpu < nr_cpu_ids && cpu_online(cpu))
            /* 发送IPI，进行重新调度task*/
			smp_send_reschedule(cpu);
	}
	put_cpu();
}
```

继续查看vmx_handle_exit

```c
static int vmx_handle_exit(struct kvm_vcpu *vcpu, fastpath_t exit_fastpath)
{
	int ret = __vmx_handle_exit(vcpu, exit_fastpath);

	if (to_vmx(vcpu)->exit_reason.bus_lock_detected) {
		if (ret > 0)
			vcpu->run->exit_reason = KVM_EXIT_X86_BUS_LOCK;

		vcpu->run->flags |= KVM_RUN_X86_BUS_LOCK;
		return 0;
	}
	return ret;
}

static int __vmx_handle_exit(struct kvm_vcpu *vcpu, fastpath_t exit_fastpath)
{
    ...
    /* 是WRITE_MSR 原因导致的vm_exit*/
	if (exit_reason.basic == EXIT_REASON_MSR_WRITE)
		return kvm_emulate_wrmsr(vcpu);
	...
}
/* 处理msr 写入*/
int kvm_emulate_wrmsr(struct kvm_vcpu *vcpu)
{
	u32 ecx = kvm_rcx_read(vcpu);
	u64 data = kvm_read_edx_eax(vcpu);
	int r;

	r = kvm_set_msr(vcpu, ecx, data);

	/* MSR write failed? See if we should ask user space */
	if (r && kvm_set_msr_user_space(vcpu, ecx, data, r))
		/* Bounce to user space */
		return 0;

	/* Signal all other negative errors to userspace */
	if (r < 0)
		return r;

	if (!r)
		trace_kvm_msr_write(ecx, data);
	else
		trace_kvm_msr_write_ex(ecx, data);

	return static_call(kvm_x86_complete_emulated_msr)(vcpu, r);
}

int kvm_set_msr(struct kvm_vcpu *vcpu, u32 index, u64 data)
{
	return kvm_set_msr_ignored_check(vcpu, index, data, false);
}

static int kvm_set_msr_ignored_check(struct kvm_vcpu *vcpu,
				     u32 index, u64 data, bool host_initiated)
{
	int ret = __kvm_set_msr(vcpu, index, data, host_initiated);

	if (ret == KVM_MSR_RET_INVALID)
		if (kvm_msr_ignored_check(index, data, true))
			ret = 0;

	return ret;
}

static int __kvm_set_msr(struct kvm_vcpu *vcpu, u32 index, u64 data,
			 bool host_initiated)
{
    ...
    /* 静态调用机制是内核的一种优化手段，目的是减少动态函数指针调用的性能开销。在传统动态调用中，
    调用函数指针需要额外的间接跳转开销（例如通过寄存器保存目标地址）。静态调用通过在编译时或运行时
    将调用点的目标函数直接替换成最终实现函数，避免了这一开销 */
    
    /*最终调用vmx_set_msr */
    return static_call(kvm_x86_set_msr)(vcpu, &msr);
}

/*
 * Writes msr value into the appropriate "register".
 * Returns 0 on success, non-0 otherwise.
 * Assumes vcpu_load() was already called.
 */
static int vmx_set_msr(struct kvm_vcpu *vcpu, struct msr_data *msr_info){
    struct vcpu_vmx *vmx = to_vmx(vcpu);
	struct vmx_uret_msr *msr;
	int ret = 0;
	u32 msr_index = msr_info->index;
	u64 data = msr_info->data;
	u32 index;

	switch (msr_index) {
    
    ...
	case MSR_IA32_DEBUGCTLMSR:
		if (is_guest_mode(vcpu) && get_vmcs12(vcpu)->vm_exit_controls &
						VM_EXIT_SAVE_DEBUG_CONTROLS)
			get_vmcs12(vcpu)->guest_ia32_debugctl = data;

		ret = kvm_set_msr_common(vcpu, msr_info);
		break;
	}
    ...
}

```

最终的处理函数：arch/x86/kvm/x86.c

```c
int kvm_set_msr_common(struct kvm_vcpu *vcpu, struct msr_data *msr_info)
{
	bool pr = false;
	u32 msr = msr_info->index;
	u64 data = msr_info->data;

	switch (msr) {
    ...
    case MSR_IA32_DEBUGCTLMSR:
		if (!data) {
			/* We support the non-activated case already */
			break;
		} else if (data & ~(DEBUGCTLMSR_LBR | DEBUGCTLMSR_BTF)) {
			/* Values other than LBR and BTF are vendor-specific,
			   thus reserved and should throw a #GP */
			return 1;
		} else if (report_ignored_msrs)
			vcpu_unimpl(vcpu, "%s: MSR_IA32_DEBUGCTLMSR 0x%llx, nop\n",
				    __func__, data);
		break;
    }
    ...
}

```

msr寄存器主要用于存储和控制与处理器相关的特定硬件状态或功能，为了安全起见，除 LBR 和 BTF 外的值是厂商特定的，因此属于保留位，否则会触发 #GP 异常，全称是 **General Protection Fault**（通用保护异常），它是 x86 架构中由 CPU 硬件触发的一种异常，用于报告违反保护模式规则的操作。此操作可配置，在/sys/module/kvm/parameters/ignore_msrs可以控制是否忽略掉这个错误。
