// Custom Error Classes
export class ProjectTemplateError extends Error {
    constructor(message: string, public readonly code: string) {
        super(message);
        this.name = 'ProjectTemplateError';
    }
}

export class FileNotFoundError extends ProjectTemplateError {
    constructor(fileName: string, repoUrl: string) {
        super(`File '${fileName}' not found in repository ${repoUrl}`, 'FILE_NOT_FOUND');
        this.name = 'FileNotFoundError';
    }
}

export class EmptyFileError extends ProjectTemplateError {
    constructor(fileName: string, repoUrl: string) {
        super(`File '${fileName}' is empty in repository ${repoUrl}`, 'EMPTY_FILE');
        this.name = 'EmptyFileError';
    }
}

export class InvalidJsonError extends ProjectTemplateError {
    constructor(fileName: string, repoUrl: string, originalError: string) {
        super(`Invalid JSON in file '${fileName}' from repository ${repoUrl}: ${originalError}`, 'INVALID_JSON');
        this.name = 'InvalidJsonError';
    }
}

export class GitOperationError extends ProjectTemplateError {
    constructor(repoUrl: string, originalError: string) {
        super(`Failed to clone repository ${repoUrl}: ${originalError}`, 'GIT_OPERATION_FAILED');
        this.name = 'GitOperationError';
    }
}

export class TemplateValidationError extends ProjectTemplateError {
    constructor(message: string, public readonly field: string) {
        super(message, 'TEMPLATE_VALIDATION_ERROR');
        this.name = 'TemplateValidationError';
    }
}

export class NetworkError extends ProjectTemplateError {
    constructor(repoUrl: string, originalError: string) {
        super(`Network error while accessing repository ${repoUrl}: ${originalError}`, 'NETWORK_ERROR');
        this.name = 'NetworkError';
    }
}

// Error type guards
export const isProjectTemplateError = (error: unknown): error is ProjectTemplateError => {
    return error instanceof ProjectTemplateError;
};

export const isFileNotFoundError = (error: unknown): error is FileNotFoundError => {
    return error instanceof FileNotFoundError;
};

export const isTemplateValidationError = (error: unknown): error is TemplateValidationError => {
    return error instanceof TemplateValidationError;
};
