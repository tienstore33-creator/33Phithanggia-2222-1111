import { KnowledgeBase } from '../../types';

/**
 * combatContextFormatter.ts
 * 
 * Đóng gói toàn bộ bối cảnh nhân vật MC, Đồng minh, Kẻ thù (Chỉ số, Kỹ năng, Vật phẩm, Tài sản, Giới tính, Tiểu sử...) 
 * vào các thẻ XML chuẩn cấu trúc để AI nắm bắt bối cảnh chính xác nhất, tránh tự bịa chiêu thức hay tài sản.
 */

export function buildCombatContextXml(
  kb: KnowledgeBase,
  activeOpponents: any[],
  activeCompanions: any[]
): string {
  const player = kb.playerStats;
  const worldConfig = kb.worldConfig;
  
  const playerName = worldConfig?.playerName || player?.name || 'Người Chơi';
  const playerGender = worldConfig?.playerGender || 'Nam';
  const playerRace = worldConfig?.playerRace || 'Nhân Tộc';
  const playerRealm = player?.realm || worldConfig?.canhGioiKhoiDau || 'Chưa rõ';
  const spiritualRoot = player?.spiritualRoot || worldConfig?.playerSpiritualRoot || 'Không rõ';
  const specialPhysique = player?.specialPhysique || worldConfig?.playerSpecialPhysique || 'Bình thường';
  const backstory = worldConfig?.playerBackstory || player?.description || 'Chưa có tiểu sử';
  const currencyName = worldConfig?.currencyName || 'Ngân Lượng / Linh Thạch';

  // Tài sản
  const linhThach = player?.linhThach ?? player?.currency ?? 0;
  const tien = player?.tien ?? 0;

  // Kỹ năng MC
  const playerSkills = kb.playerSkills || [];
  const skillsListStr = playerSkills.length > 0
    ? playerSkills.map((s: any) => 
        `- [Kỹ năng] ${s.name}: ${s.description || 'Không mô tả'} (Năng lượng tiêu tốn: ${s.manaCost || s.mpCost || 0} MP, Sát thương cơ bản: ${s.baseDamage || s.damage || 0})`
      ).join('\n    ')
    : 'Chưa học kỹ năng nào';

  // Túi đồ / Vật phẩm MC
  const playerInventory = kb.inventory || [];
  const inventoryListStr = playerInventory.length > 0
    ? playerInventory.map((item: any) => 
        `- [Vật phẩm] ${item.name} (Số lượng: ${item.quantity || 1}): ${item.description || 'Không mô tả'}`
      ).join('\n    ')
    : 'Túi đồ rỗng';

  // Trang bị đang mang
  const equippedItemsMap = kb.equippedItems || {};
  const equippedKeys = Object.keys(equippedItemsMap).filter(k => equippedItemsMap[k as keyof typeof equippedItemsMap]);
  let equippedListStr = 'Không mang trang bị nào';
  if (equippedKeys.length > 0) {
    equippedListStr = equippedKeys.map(slot => {
      const itemId = equippedItemsMap[slot as keyof typeof equippedItemsMap];
      const itemObj = playerInventory.find((i: any) => i.id === itemId);
      return `- [Trang bị - ${slot}] ${itemObj ? itemObj.name : itemId}`;
    }).join('\n    ');
  }

  const ATK_MULTIPLIER = 4;

  // Formatting Đồng minh
  let companionsXml = '<khong_co_dong_minh />';
  if (activeCompanions && activeCompanions.length > 0) {
    companionsXml = activeCompanions.map((c: any, index: number) => {
      const name = c.name || 'Đồng minh';
      const id = c.id || `ally_${index}`;
      const gender = c.gender || 'Chưa rõ';
      const realm = c.realm || c.stats?.realm || 'Chưa rõ';
      const hp = `${c.hp ?? c.stats?.sinhLuc ?? 0}/${c.maxHp ?? c.stats?.maxSinhLuc ?? 0}`;
      const mp = `${c.mana ?? c.stats?.linhLuc ?? 0}/${c.maxMana ?? c.stats?.maxLinhLuc ?? 0}`;
      const baseAtk = c.atk ?? c.stats?.sucTanCong ?? 0;
      const atk = baseAtk * ATK_MULTIPLIER;
      const skills = (c.skills || []).map((s: any) => typeof s === 'string' ? s : s.name).join(', ') || 'Chiêu thức cơ bản';
      const items = (c.inventory || []).map((i: any) => typeof i === 'string' ? i : i.name).join(', ') || 'Túi đồ rỗng';

      return `  <dong_minh>
    <id>${id}</id>
    <ten>${name}</ten>
    <dinh_danh>${id}@@${name}</dinh_danh>
    <gioi_tinh>${gender}</gioi_tinh>
    <tu_vi_canh_gioi>${realm}</tu_vi_canh_gioi>
    <chi_so_sinh_ton>HP: ${hp} | MP: ${mp} | ATK: ${atk}</chi_so_sinh_ton>
    <ky_nang>${skills}</ky_nang>
    <hanh_trang>${items}</hanh_trang>
  </dong_minh>`;
    }).join('\n');
  }

  // Formatting Kẻ thù / Đối thủ
  let opponentsXml = '<khong_co_ke_thu />';
  if (activeOpponents && activeOpponents.length > 0) {
    opponentsXml = activeOpponents.map((o: any, index: number) => {
      const name = o.name || 'Kẻ thù';
      const id = o.id || `enemy_${index}`;
      const gender = o.gender || o.species || 'Không rõ';
      const realm = o.stats?.realm || o.realm || 'Chưa rõ';
      const hp = `${o.stats?.sinhLuc ?? o.hp ?? 0}/${o.stats?.maxSinhLuc ?? o.maxHp ?? 0}`;
      const mp = `${o.stats?.linhLuc ?? o.mana ?? 0}/${o.stats?.maxLinhLuc ?? o.maxMana ?? 0}`;
      const baseAtk = o.stats?.sucTanCong ?? o.atk ?? 0;
      const atk = baseAtk * ATK_MULTIPLIER;
      const def = o.stats?.phongNgu ?? o.def ?? 0;
      const desc = o.description || o.personality || o.appearance || 'Kẻ thù nguy hiểm';
      const skills = (o.skills || []).map((s: any) => typeof s === 'string' ? s : s.name).join(', ') || 'Kỹ năng chiến đấu thông thường';
      const items = (o.inventory || []).map((i: any) => typeof i === 'string' ? i : i.name).join(', ') || 'Không mang vật phẩm quý';

      return `  <ke_thu>
    <id>${id}</id>
    <ten>${name}</ten>
    <dinh_danh>${id}@@${name}</dinh_danh>
    <gioi_tinh_hoac_loai>${gender}</gioi_tinh_hoac_loai>
    <tu_vi_canh_gioi>${realm}</tu_vi_canh_gioi>
    <chi_so_sinh_ton>HP: ${hp} | MP: ${mp} | ATK: ${atk} | DEF: ${def}</chi_so_sinh_ton>
    <mo_ta_tieu_su>${desc}</mo_ta_tieu_su>
    <ky_nang_chieu_thuc>${skills}</ky_nang_chieu_thuc>
    <trang_bi_vat_pham>${items}</trang_bi_vat_pham>
  </ke_thu>`;
    }).join('\n');
  }

  return `<thong_tin_chien_dau_chi_tiet>
  <nhan_vat_chinh_mc>
    <ten>${playerName}</ten>
    <gioi_tinh>${playerGender}</gioi_tinh>
    <chung_toc>${playerRace}</chung_toc>
    <canh_gioi_tu_vi>${playerRealm}</canh_gioi_tu_vi>
    <linh_can>${spiritualRoot}</linh_can>
    <the_chat_dac_biet>${specialPhysique}</the_chat_dac_biet>
    <tieu_su_than_the>${backstory}</tieu_su_than_the>
    <chi_so_sinh_ton>
      - Sinh lực (HP): ${player?.sinhLuc ?? 0}/${player?.maxSinhLuc ?? 0}
      - Linh lực (MP): ${player?.linhLuc ?? 0}/${player?.maxLinhLuc ?? 0}
      - Sức tấn công (ATK): ${(player?.sucTanCong ?? 0) * ATK_MULTIPLIER}
      - Phòng ngự (DEF): ${player?.phongNgu ?? 0}
    </chi_so_sinh_ton>
    <tai_san_hien_co>
      - Linh thạch: ${linhThach}
      - Tiền tệ (${currencyName}): ${tien}
    </tai_san_hien_co>
    <danh_sach_ky_nang_cong_phap>
      ${skillsListStr}
    </danh_sach_ky_nang_cong_phap>
    <tui_do_hanh_trang>
      ${inventoryListStr}
    </tui_do_hanh_trang>
    <trang_bi_dang_mac>
      ${equippedListStr}
    </trang_bi_dang_mac>
  </nhan_vat_chinh_mc>

  <phe_dong_minh_tham_chien>
${companionsXml}
  </phe_dong_minh_tham_chien>

  <phe_ke_thu_doi_thu>
${opponentsXml}
  </phe_ke_thu_doi_thu>
</thong_tin_chien_dau_chi_tiet>`;
}
