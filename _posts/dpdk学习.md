# DPDK 搭建

https://blog.csdn.net/locahuang/article/details/120356849

https://www.cnblogs.com/wt11/p/15936005.html

## Example 

| 示例名称         | 描述                                                        | 功能                                                         | 学习目标                                           |
| ---------------- | ----------------------------------------------------------- | ------------------------------------------------------------ | -------------------------------------------------- |
| helloworld       | DPDK入门示例，展示应用程序基本结构和EAL初始化               | 初始化DPDK环境、配置内存和启动CPU核心，打印“Hello World”     | 熟悉DPDK的基本编程模型和环境初始化                 |
| cmdline          | 使用DPDK的命令行库解析命令行输入                            | 初始化DPDK环境，解析命令行参数，处理基本的命令行输入         | 学习使用DPDK命令行库来处理用户输入                 |
| l2fwd            | 二层转发示例，展示数据包的接收和转发操作                    | 从网卡端口接收数据包，解析以太网头部，并转发数据包到另一个端口 | 掌握基本的数据包处理流程，包括接收、解析和发送     |
| l3fwd            | 三层转发示例，增加了基于IP地址的路由功能                    | 解析IP头部、进行路由表查找，并转发数据包到相应的端口         | 学习复杂的数据包处理技术，包括IP地址解析和路由查找 |
| ip_pipeline      | 构建高性能IP数据包处理流水线的示例                          | 将数据包处理分解为多个独立阶段，每个阶段在不同的CPU核心上运行 | 设计和实现高性能的数据包处理流水线                 |
| ip_fragmentation | 展示IP数据包的分片和重组技术                                | 对大于MTU的大数据包进行分片，并在接收端重新组装分片数据包    | 处理大流量和复杂数据包结构的应用                   |
| vhost            | 展示DPDK在虚拟化环境中的高性能虚拟机间通信                  | 使用vhost-user接口将虚拟机网络接口连接到DPDK，实现高速数据传输 | 配置和使用vhost-user接口，优化虚拟机网络性能       |
| kni              | Kernel NIC Interface（KNI）示例，用户态和内核态共享网络接口 | 通过KNI模块实现DPDK与内核网络栈的接口共享和数据交换          | 理解用户态与内核态的接口共享机制，优化数据交换性能 |
| bond             | 网络接口绑定示例，将多个物理网卡绑定为一个逻辑接口          | 将多个网卡绑定在一起，实现负载均衡和冗余，提高网络可靠性和带宽 | 配置和使用网络接口绑定技术，提高网络性能和可靠性   |

## helloworld代码

```c
/* SPDX-License-Identifier: BSD-3-Clause
 * Copyright(c) 2010-2014 Intel Corporation
 */

#include <stdio.h>
#include <string.h>
#include <stdint.h>
#include <errno.h>
#include <sys/queue.h>

#include <rte_memory.h>
#include <rte_launch.h>
#include <rte_eal.h>
#include <rte_per_lcore.h>
#include <rte_lcore.h>
#include <rte_debug.h>

static int
lcore_hello(__rte_unused void *arg)
{
	unsigned lcore_id;
	lcore_id = rte_lcore_id();
	printf("hello from core %u\n", lcore_id);
	return 0;
}

int
main(int argc, char **argv)
{
	int ret;
	unsigned lcore_id;

	// 初始化EAL 
	ret = rte_eal_init(argc, argv);
	if (ret < 0)
		rte_panic("Cannot init EAL\n");

	/* 在每个工作逻辑核心上调用lcore_hello()函数 */
	/* call lcore_hello() on every worker lcore */
	RTE_LCORE_FOREACH_WORKER(lcore_id) {
		rte_eal_remote_launch(lcore_hello, NULL, lcore_id);
	}

	/* 在主逻辑核心上也调用lcore_hello()函数 */
	/* call it on main lcore too */
	lcore_hello(NULL);

	// 等待所有逻辑核心执行完毕
	rte_eal_mp_wait_lcore();

	/* 清理EAL */
	/* clean up the EAL */
	rte_eal_cleanup();

	return 0;
}
```

# DPDK 介绍

![图片](http://www.bi2.com.cn/images/article/2021/41/002.jpg)

![image-20240721130808281](C:\Users\zhaogang\AppData\Roaming\Typora\typora-user-images\image-20240721130808281.png)

LPM 快速查找路由表相关

## 环境抽象层

   环境抽象层 (EAL) 提供了一个通用接口，该接口对应用程序和库隐藏了环境细节。EAL 提供的服务是：

- DPDK 加载和启动

- 支持多进程和多线程执行类型

- 核心关联/分配程序

- 系统内存分配/解除分配

- 原子/锁操作

- 时间参考

- PCI总线访问

- 跟踪和调试功能

- CPU特性识别

- 中断处理

- 报警操作

- 内存管理（malloc）

  

## 环管理器 (librte_ring)

  环形结构在有限大小的表中提供了一个无锁的多生产者、多消费者 FIFO API。它比无锁队列有一些优势；更容易实施，适应批量操作，速度更快。环由内存池管理器 (librte_mempool) 使用，并可用作核心和/或逻辑核心上连接在一起的执行块之间的通用通信机制。

### 内存池管理器 (librte_mempool)

内存池管理器负责分配内存中的对象池。池由名称标识并使用环来存储空闲对象，它提供了一些其他可选服务，例如每核对象缓存和对齐助手，以确保填充对象以在所有 RAM 通道上均匀分布它们。

### 网络数据包缓冲区管理 (librte_mbuf)

mbuf 库提供了创建和销毁缓冲区的功能，DPDK 应用程序可以使用这些缓冲区来存储消息缓冲区。消息缓冲区在启动时创建并存储在内存池中，使用 DPDK 内存池库。该库提供了一个 API 来分配/释放 mbuf，操作用于承载网络数据包的数据包缓冲区。

### 定时器管理器 (librte_timer)

该库为 DPDK 执行单元提供定时器服务，提供异步执行功能的能力。它可以是周期性的函数调用，也可以是一次性调用。它使用环境抽象层 (EAL) 提供的计时器接口来获取精确的时间参考，并且可以根据需要在每个内核的基础上启动。

##  以太网* 轮询模式驱动程序架构 PMD

DPDK 包括用于 1 GbE、10 GbE 和 40 GbE 的轮询模式驱动程序 (PMD)，以及半虚拟化的 virtio 以太网控制器，这些控制器旨在在没有异步、基于中断的信号机制的情况下工作。

## 数据包转发算法支持

DPDK 包括哈希（librte_hash）和最长前缀匹配（LPM，librte_lpm）库，以支持相应的数据包转发算法。

# DPDK转发架构

![dpdk-udp](D:\github\ruoniao.github.io\assets\img\dpdk\dpdk-udp.jpg)
