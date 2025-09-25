import type FileMetaData from '../../Typings/fileMetaData';
import type { LnkData } from '../../Typings/fileMetaData';

export interface DirectoryData {
        files: FileMetaData[];
        number_of_files: number;
        skipped_files: string[];
        lnk_files: LnkData[];
}
