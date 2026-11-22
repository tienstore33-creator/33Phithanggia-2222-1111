export type DefeatOutcome = 'reincarnate' | 'prisoner' | 'released' | 'escaped';

export function determineDefeatOutcome(choice: 'suicide' | 'beg' | 'run'): DefeatOutcome {
    const isSuccess = Math.random() < 0.5;
    
    switch (choice) {
        case 'suicide':
            return 'reincarnate'; // LUÔN LUÔN THÀNH CÔNG (Tọa hóa chết hẳn)
        case 'beg':
            return isSuccess ? 'released' : 'prisoner';
        case 'run':
            return isSuccess ? 'escaped' : 'prisoner';
        default:
            return 'prisoner';
    }
}
