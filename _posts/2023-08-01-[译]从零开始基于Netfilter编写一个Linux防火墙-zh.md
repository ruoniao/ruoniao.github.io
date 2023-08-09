---
layout    : post
title     : "从零开始基于Netfilter编写一个Linux防火墙"
date      : 2023-08-01
lastupdate: 2023-02-11
categories: kernel
---

### 译者序

本文翻译自国人一篇[blog](https://levelup.gitconnected.com/write-a-linux-firewall-from-scratch-based-on-netfilter-462013202686),详实的介绍了从如何编写一个内核模块到利用netfilter实现一个简单的mini firewalld，本文知识递进，条理清晰，对入门内核网络相关编码非常有帮助。

**由于译者水平有限，本文不免存在遗漏或错误之处。如有疑问，请查阅原文。**

以下是译文。

# 摘要 

防火墙是一种重要的工具，可以配置用于保护您的服务器和基础设施。防火墙的主要功能包括数据过滤、流量重定向和保护免受网络攻击。有硬件型防火墙和软件型防火墙两种。在这里，我不会过多地讨论背景，因为您可以在许多[在线文档](https://en.wikipedia.org/wiki/Firewall_(computing))中找到相关信息。

你有没有想过从零开始实现一个简单的迷你防火墙？听起来很疯狂吗？但借助Linux的强大功能，你是可以做到的。在阅读了这一系列的文章之后，你会发现实际上这并不是太复杂。

你或许曾在Linux上使用过各种防火墙，比如iptables、nftables、UFW等。所有这些防火墙工具都是用户空间实用程序，它们都依赖于Netfilter。Netfilter是Linux内核的一个子系统，允许实现各种与网络相关的操作。Netfilter允许你使用Linux内核模块开发自己的防火墙。如果你对诸如Linux内核模块和Netfilter之类的技术不太了解，不用担心。在这篇文章中，让我们从零开始基于Netfilter编写一个Linux防火墙。你可以学到以下有趣的内容：

- Linux内核模块开发。
- Linux内核网络编程。
- Netfilter模块开发。

这篇文章会比较长，分为五个部分：

1. Netfilter和内核模块背景：介绍Netfilter和内核模块的理论知识。
2. 创建第一个内核模块：学习如何编写一个简单的内核模块。
3. Netfilter架构和API：回顾Netfilter钩子架构和源代码。
4. 实现迷你防火墙：编写迷你防火墙的代码。

# Netfilter和内核模块背景
## Netfilter基础知识
Netfilter可以被视为Linux上的第三代防火墙。在Linux内核2.4引入Netfilter之前，存在两代较旧的Linux防火墙，如下所述：

- 第一代是将早期版本的BSD UNIX的ipfw移植到Linux 1.1。
- 第二代是在Linux内核2.2系列中开发的ipchains。

正如我们上面提到的，Netfilter旨在为Linux内核中的各种网络操作提供基础架构。因此，防火墙只是Netfilter提供的多个功能之一，如下所示：

![](/assets/img/mini_firewalld/1.png)
