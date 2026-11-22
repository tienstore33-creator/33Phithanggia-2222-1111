import { LSR_DATA } from "@/constants/lsr_config";

export interface LsrTableDefinition {
    id: string;
    name: string;
    columns: string[];
}

export const LsrParser = {
    /**
     * Parses the static structure of LSR tables from the configuration.
     * Looks for patterns like "#0 TableName|0:Col1|1:Col2" inside the definition block.
     */
    parseDefinitions(): LsrTableDefinition[] {
        const contentToScan = LSR_DATA.entries["6"].content;
        const lines = contentToScan.split('\n');
        const tables: LsrTableDefinition[] = [];

        // Regex to match: #ID Name|0:Col|1:Col...
        const tableDefRegex = /^#(\d+)\s+([^|]+)\|(.*)$/;

        lines.forEach(line => {
            const match = line.trim().match(tableDefRegex);
            if (match) {
                const id = match[1];
                const name = match[2].trim();
                const rawColumns = match[3];

                // Parse columns: "0:Name|1:Age" -> ["Name", "Age"]
                const columns = rawColumns.split('|').map(col => {
                    const colParts = col.split(':');
                    return colParts.length > 1 ? colParts.slice(1).join(':').trim() : col.trim();
                });

                tables.push({ id, name, columns });
            }
        });

        return tables;
    },

    /**
     * Parses the runtime output from AI (Text-based LSR format).
     * Format:
     * <table_stored>
     * #0 Thông tin Hiện tại|0:Năm Thương Lan 3025|1:Hang đá
     * #1 Nhân vật Gần đây|0:Lộ Na|1:0|2:Ăn uống
     * </table_stored>
     * 
     * Returns a map of TableID -> Array of Rows (objects)
     */
    parseLsrString(rawString: string): Record<string, any[]> {
        const result: Record<string, any[]> = {};
        
        if (!rawString) return result;

        const lines = rawString.split('\n');
        
        lines.forEach(line => {
            line = line.trim();
            // Bỏ qua dòng trống hoặc không bắt đầu bằng #
            if (!line.startsWith('#')) return;

            // Pattern: #ID Name|Data...
            const match = line.match(/^#(\d+)\s+([^|]+)\|(.*)$/);
            if (match) {
                const tableId = match[1];
                const rawData = match[3];

                const rowObj: Record<string, string> = {};
                
                // Split theo dấu |
                const cols = rawData.split('|');
                cols.forEach(col => {
                    // Format: Index:Value
                    // Tìm dấu hai chấm đầu tiên để tránh lỗi khi giá trị chứa dấu :
                    const firstColonIndex = col.indexOf(':');
                    if (firstColonIndex !== -1) {
                        const colIdx = col.substring(0, firstColonIndex).trim();
                        const colVal = col.substring(firstColonIndex + 1).trim();
                        rowObj[colIdx] = colVal;
                    }
                });

                if (!result[tableId]) {
                    result[tableId] = [];
                }
                result[tableId].push(rowObj);
            }
        });

        return result;
    }
};
