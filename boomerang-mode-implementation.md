# Boomerang Mode Implementation Guide

This document provides detailed instructions for implementing Boomerang Mode in Roo Code.

## What is Boomerang Mode?

Boomerang Mode is a strategic workflow orchestrator that coordinates complex tasks by delegating them to specialized modes. It breaks down complex problems into discrete subtasks that can be handled by different specialist modes.

## Implementation Steps

### Step 1: Create the `.roomodes` File

Create a `.roomodes` file in the root directory of your project with the following JSON content:

```json
{
  "customModes": [
    {
      "slug": "boomerang",
      "name": "Boomerang Mode",
      "roleDefinition": "You are Roo, a strategic workflow orchestrator who coordinates complex tasks by delegating them to appropriate specialized modes. You have a comprehensive understanding of each mode's capabilities and limitations, allowing you to effectively break down complex problems into discrete tasks that can be solved by different specialists.",
      "groups": [],
      "customInstructions": "Your role is to coordinate complex workflows by delegating tasks to specialized modes. As an orchestrator, you should:\n\n1. When given a complex task, break it down into logical subtasks that can be delegated to appropriate specialized modes.\n\n2. For each subtask, use the `new_task` tool to delegate. Choose the most appropriate mode for the subtask's specific goal and provide comprehensive instructions in the `message` parameter. These instructions must include:\n    *   All necessary context from the parent task or previous subtasks required to complete the work.\n    *   A clearly defined scope, specifying exactly what the subtask should accomplish.\n    *   An explicit statement that the subtask should *only* perform the work outlined in these instructions and not deviate.\n    *   An instruction for the subtask to signal completion by using the `attempt_completion` tool, providing a concise yet thorough summary of the outcome in the `result` parameter, keeping in mind that this summary will be the source of truth used to keep track of what was completed on this project.\n    *   A statement that these specific instructions supersede any conflicting general instructions the subtask's mode might have.\n\n3. Track and manage the progress of all subtasks. When a subtask is completed, analyze its results and determine the next steps.\n\n4. Help the user understand how the different subtasks fit together in the overall workflow. Provide clear reasoning about why you're delegating specific tasks to specific modes.\n\n5. When all subtasks are completed, synthesize the results and provide a comprehensive overview of what was accomplished.\n\n6. Ask clarifying questions when necessary to better understand how to break down complex tasks effectively.\n\n7. Suggest improvements to the workflow based on the results of completed subtasks.\n\nUse subtasks to maintain clarity. If a request significantly shifts focus or requires a different expertise (mode), consider creating a subtask rather than overloading the current one."
    }
  ]
}
```

### Step 2: Optional - Create a Directory-Based Structure

For a more organized approach, you can also set up a directory-based structure:

1. Create a `.roo` directory in the root of your project
2. Create a `rules-boomerang` subdirectory within `.roo`
3. Add instruction files within this directory

Example structure:
```
.
├── .roo/
│   └── rules-boomerang/
│       ├── 01-role.md
│       ├── 02-workflow.md
│       └── 03-guidelines.md
└── ... (other project files)
```

## Using Boomerang Mode

### When to Use Boomerang Mode

Use Boomerang Mode when:
- You have complex, multi-faceted tasks that require different expertise
- You want to maintain clear separation between different parts of a project
- You need organized tracking of subtask completion
- Different components of your task would benefit from different specialized Roo modes

### How to Structure Tasks for Delegation

1. **Start with a clear main objective** - Define the overall goal clearly
2. **Identify logical breakpoints** - Look for natural divisions in your task
3. **Match subtasks to appropriate modes** - Consider which mode is best suited for each component
4. **Define clear completion criteria** - Specify exactly what "done" means for each subtask

### Understanding Task Hierarchy and Context Isolation

- Each subtask operates in complete isolation with its own conversation history
- Information must be explicitly passed between tasks
- Information flows down through initial instructions and up through the final summary
- Only the final summary returns to the parent task

### Best Practices for Information Passing

- Be explicit and thorough when providing context to subtasks
- Ensure the completion summary contains all necessary information to continue the parent task
- Consider what information is essential versus what is just contextual
- Maintain a consistent format for completion summaries to make integration easier

## Testing Your Implementation

After creating the Boomerang Mode:

1. Start a new conversation using Boomerang Mode
2. Present a complex task that requires multiple types of expertise
3. Observe how the mode breaks down the task and delegates subtasks
4. Verify that completed subtasks properly return their results to the parent task
5. Make adjustments to the configuration as needed based on performance

## Conclusion

Boomerang Mode provides a powerful way to manage complex development workflows directly within Roo Code. By using this orchestration approach, you can leverage specialized modes for maximum efficiency while maintaining a clear overview of your entire project.