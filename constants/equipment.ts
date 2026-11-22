
import { EquipmentSlotConfig } from '../types';

export const EQUIPMENT_SLOTS_CONFIG: EquipmentSlotConfig[] = [
  { id: 'mainWeapon', labelKey: 'slotMainWeapon', accepts: ['Vũ Khí'] },
  { id: 'offHandWeapon', labelKey: 'slotOffHandWeapon', accepts: ['Vũ Khí', 'Khiên', 'Pháp Bảo'] },
  { id: 'head', labelKey: 'slotHead', accepts: ['Giáp Đầu'] },
  { id: 'body', labelKey: 'slotBody', accepts: ['Giáp Thân'] },
  { id: 'hands', labelKey: 'slotHands', accepts: ['Giáp Tay'] },
  { id: 'legs', labelKey: 'slotLegs', accepts: ['Giáp Chân'] },
  { id: 'artifact', labelKey: 'slotArtifact', accepts: ['Pháp Bảo'] },
  { id: 'pet', labelKey: 'slotPet', accepts: ['Thú Cưng'] },
  { id: 'accessory1', labelKey: 'slotAccessory1', accepts: ['Trang Sức'] },
  { id: 'accessory2', labelKey: 'slotAccessory2', accepts: ['Trang Sức'] },
];
