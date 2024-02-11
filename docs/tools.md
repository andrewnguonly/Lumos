# Tools (Experimental)

The integration of [LangChain Tools](https://js.langchain.com/docs/modules/agents/tools/) into Lumos is an experimental feature. Lumos is not an [Agent](https://js.langchain.com/docs/modules/agents/) per se. However, the implementation automatically invokes tools when appropriate.

Messages from tools will be in light blue with a hammer avatar.
![Tool Message](../screenshots/tool_message.png)

## Calculator

The `Calculator` tool evaluates arithmetic expressions. For example, the prompt `What's 45*6+7=?` will return `277`.

**Warning**: Double-check all calculations.
