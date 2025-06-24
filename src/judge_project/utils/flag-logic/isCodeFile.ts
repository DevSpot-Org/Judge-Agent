import { includePatterns } from '../../../constants/include-patterns';

export const isCodeFile = (filename: string): boolean => {
    const nonCodeFiles = [
        'readme',
        'license',
        'changelog',
        'contributing',
        'code_of_conduct',
        'gitignore',
        'gitattributes',
        'package-lock.json',
        'yarn.lock',
        'composer.lock',
        'pipfile.lock',
        'cargo.lock',
    ];

    const lowerFilename = filename.toLowerCase();

    // Check if it's explicitly a non-code file
    for (const nonCode of nonCodeFiles) {
        if (lowerFilename.includes(nonCode)) {
            return false;
        }
    }

    // Check if it has a code extension
    return [...includePatterns].some(ext => lowerFilename.endsWith(`.${ext}`));
};
