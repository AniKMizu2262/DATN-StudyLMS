# Kdocument — Development Plan

## Project Goal

Build a Learning Management System (LMS) with an AI assistant that answers questions using course documents. Prioritize a working, maintainable system that can be tested, demonstrated, and documented before the December 2026 graduation deadline.

## Phase 1: Requirements and Design

- [ ] Finalize the minimum viable feature scope.
- [ ] Define Admin, Teacher, and Student roles and permissions.
- [ ] Document functional and non-functional requirements.
- [ ] Create the Use Case diagram.
- [ ] Design the ERD and data dictionary.
- [ ] Define the initial system architecture and technology stack.

**Completion criteria:** Core requirements, user permissions, and database design are documented.

## Phase 2: Project Setup

- [ ] Create the frontend and backend project structure.
- [ ] Configure environment variables and `.env.example`.
- [ ] Connect the backend to MySQL.
- [ ] Configure Git branches and commit conventions.
- [ ] Run a basic frontend, backend, and database connection test.

**Completion criteria:** The application starts locally and the backend can communicate with MySQL.

## Phase 3: Authentication and Authorization

- [ ] Implement login and logout.
- [ ] Implement Admin, Teacher, and Student roles.
- [ ] Protect APIs using authentication and authorization middleware.
- [ ] Validate input and handle common errors.
- [ ] Test unauthorized access and role restrictions.

**Completion criteria:** Users can sign in and access only the functions and data permitted for their roles.

## Phase 4: Learning Management

- [ ] Implement user management for Admin.
- [ ] Implement subject management.
- [ ] Assign multiple teachers to a subject where needed.
- [ ] Implement PDF upload, listing, viewing, and deletion.
- [ ] Track document-processing status.
- [ ] Enforce document access permissions.
- [ ] Handle document updates and removal of related indexed content.

**Completion criteria:** Core user, subject, and document workflows work correctly.

## Phase 5: RAG and AI Assistant

- [ ] Extract text from PDF documents.
- [ ] Split extracted text into chunks and preserve page information where possible.
- [ ] Generate embeddings for document chunks.
- [ ] Store and retrieve embeddings using the selected vector storage solution.
- [ ] Retrieve relevant chunks for a user's question.
- [ ] Generate an answer grounded in retrieved content.
- [ ] Display citations and page information where available.
- [ ] Handle questions that cannot be answered from available documents.
- [ ] Prevent retrieval of documents the current user is not allowed to access.

**Completion criteria:** Users can ask questions about accessible documents and receive answers with verifiable sources.

## Phase 6: Conversation History and Basic Dashboard

- [ ] Save conversations and messages.
- [ ] List and reopen the current user's conversations.
- [ ] Allow users to delete their own conversations.
- [ ] Display basic system statistics if time permits.
- [ ] Verify conversation ownership and statistics access.

**Completion criteria:** Conversation history persists correctly and private data is protected.

## Phase 7: Testing and Deployment

- [ ] Test the main user workflows.
- [ ] Test authentication, authorization, and document access.
- [ ] Test PDF processing, retrieval quality, and citations.
- [ ] Fix critical bugs and improve usability.
- [ ] Write installation and usage instructions.
- [ ] Prepare a deployment environment.
- [ ] Complete the thesis report, presentation, and demo script.
- [ ] Test the final demo from a clean setup.

**Completion criteria:** The application can be installed, run, tested, and demonstrated using documented steps.

## Priority and Time Management

1. Complete the core LMS workflows first.
2. Build a simple end-to-end RAG pipeline before adding optional features.
3. Prioritize authentication, document access control, and source citations.
4. Treat the dashboard as optional if the deadline becomes tight.
5. Reserve time for testing, deployment, thesis writing, presentation preparation, and the B1 exam.
6. Avoid adding technologies or features without a clear project requirement.

## Development Principles

- Prefer readable, maintainable code over unnecessary complexity.
- Break work into small, independently testable tasks.
- Keep secrets and local environment files out of Git.
- Commit and push completed work regularly.
- Verify each phase before moving to the next.
- Update this plan when implementation decisions change.