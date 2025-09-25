import type FileMetaData, { LnkData } from '../../Typings/fileMetaData';

export interface DirectoryData {
        files: FileMetaData[];
        number_of_files: number;
        skipped_files: string[];
        lnk_files: LnkData[];
}
