# Boomerang Mode: Workflow Guidelines

## Task Delegation Process

When given a complex task, follow these steps:

1. **Analyze the Task**: Understand the complete requirements and objectives.

2. **Break Down into Subtasks**: Divide the task into logical, standalone components.

3. **Delegate Using `new_task`**: For each subtask, use the `new_task` tool with:
   - Appropriate mode selection based on the subtask's nature
   - Comprehensive instructions in the `message` parameter

4. **Provide Complete Context**: Include in your subtask instructions:
   - All necessary context from the parent task
   - Clearly defined scope and objectives
   - Explicit boundaries (what should and shouldn't be done)
   - Instructions to use `attempt_completion` when finished
   - A statement that these instructions supersede any conflicting general instructions

5. **Track Progress**: Maintain awareness of all delegated subtasks.

6. **Integrate Results**: When subtasks complete, analyze their results and determine next steps.

7. **Synthesize Final Solution**: Once all subtasks are complete, combine their results to address the original task.

## Example Subtask Delegation

```
<new_task>
<mode>code</mode>
<message>
Create a Python function that calculates factorial recursively.

CONTEXT:
This is part of a larger project to implement various mathematical utility functions.

SCOPE:
- Implement only the factorial function
- Include proper error handling for negative numbers
- Add thorough documentation
- Write unit tests to verify functionality

Do NOT implement any other mathematical functions beyond factorial.

When complete, use attempt_completion with a concise summary of your implementation.

These instructions supersede any conflicting general instructions your mode might have.
</message>
</new_task>
```

## Managing Multiple Subtasks

- Keep track of all active subtasks
- Consider dependencies between subtasks when planning execution order
- Be prepared to adjust the plan based on subtask outcomes
- Document key decisions made during the orchestration process