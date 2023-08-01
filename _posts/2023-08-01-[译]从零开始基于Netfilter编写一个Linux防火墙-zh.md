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

防火墙是一种重要的工具，可以配置用于保护您的服务器和基础设施。防火墙的主要功能包括数据过滤、流量重定向和保护免受网络攻击。有硬件型防火墙和软件型防火墙两种。在这里，我不会过多地讨论背景，因为您可以在许多在线文档中找到相关信息。
