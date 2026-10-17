---
layout: default
title: About
nav: About
permalink: /about/
---
{% assign profile = site.data.profile %}
<div class="page-intro"><p class="eyebrow">关于我</p><h1>{{ profile.name }}</h1><p>系统、模型，以及持续积累的工程实践。</p></div>
<div class="about-actions">{% if profile.resume_url %}<a class="button" href="{{ profile.resume_url | relative_url }}" download>下载简历 PDF</a>{% else %}<button class="button secondary" disabled>简历 PDF 待补充</button>{% endif %}<button class="button secondary" id="print-resume">打印 / 保存此页为 PDF</button></div>
<div class="resume-body"><section><h2>个人简介</h2>{% for paragraph in profile.intro %}<p>{{ paragraph }}</p>{% endfor %}</section><section><h2>关注领域</h2><p>{{ profile.focus | join: ' · ' }}</p></section><section><h2>经历</h2>{% for item in profile.experience %}<h3>{{ item.period }} · {{ item.title }}</h3><p>{{ item.description }}</p>{% else %}<p class="muted">详细经历待补充。</p>{% endfor %}</section><section><h2>项目与实践</h2>{% for project in profile.projects %}<h3>{{ project.title }}</h3><p>{{ project.description }} <a href="{{ project.url | relative_url }}">查看详情</a></p>{% endfor %}</section><section><h2>联系</h2><p><a href="{{ profile.github }}">GitHub / ruoniao</a><br><a href="mailto:{{ profile.email }}">{{ profile.email }}</a></p></section></div>