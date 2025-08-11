---
alwaysApply: true
---

## Implementing Concepts

- Use TypeScript
- Each concept is a single class with the name `${name}Concept`, and should be
  contained in a single .ts file under the directory `./concepts`
- All actions must take exactly one argument, and return one argument
- The shape of the input and output arguments are described in the corresponding
  concept specification in the form of `key: type`
- The names of actions must match up exactly with those in the specification
- For the purposes of the `where` clause in the synchronizations, and for
  generally querying state, each concept may also have query functions
- Query functions MUST start with the underscore character `_` to distinguish
  them from actions
- Query functions MUST NOT update state or perform side-effects
- Query functions will also take as input a single argument with named keys, but
  instead **return an array** of such arguments corresponding to the names of
  the desired state. This is because query functions enable synchronizations in
  the `where` clause to e.g. declaratively find all comments related to a post,
  where each comment becomes a new frame for the purposes of the `then` clause,
  such as deleting all comments of a post when the post is deleted.
- In general, if a concept is well behaving, you should not need to update it
  except to add query functions for the purposes of accessing state
