# The app contains no LLM; agents supply all the intelligence

Despite the name, the app never calls a model. Breaking work down, choosing a lane and doing or preparing tasks all happen in the engineer's own coding agents, which reach the app through its CLI. The app is a structured store with a UI. This keeps it free of API keys and model costs, and it can be tested without an LLM. The cost is that consistent categorisation depends on the app making lanes explicit (enums, descriptions, validation) rather than on a prompt it controls.
