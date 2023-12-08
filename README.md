### apifox gen
> 用于生成后端接口对应的ts类型的aixos的接口函数，方便日常开发，不用一个个复制了！！！

#### 使用
需要去apifox官网登录后从接口的header中找到Authorization在欢迎页中进行配置，然后会生成对应的类型，直接点击对应接口选择生成目录就可以生成对应的代码，目前apifox官网请求类型全部支持，body类型支持form-data、x-www-form-urlencoded、json三种格式。

#### 配置
- 添加cookie: Authorization，欢迎页需要配置，可以替换
- 项目接口目录: 项目中存放api接口文件的目录，减少生成接口时目录选择的层级，默认
- 接口baseURL: 后端接口项目的baseURL，减少生成TS类型变量的长度
- 添加版本号：后端接口项目的版本号，必填参数