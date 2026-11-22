import sys

with open('services/PlayerZeroService.ts', 'r') as f:
    lines = f.readlines()

out_lines = []
skip = False
for line in lines:
    if line.strip().startswith("if (chosenAction === 'travel') {"):
        skip = True
        
        new_block = """            if (chosenAction === 'travel') {
                // --- ACTION: TRAVEL ---
                if (targetName) {
                    const dest = updatedKb.discoveredLocations?.find(l => l.name.includes(targetName!));
                    if (dest) {
                        pZero.locationId = dest.id || dest.name;
                    }
                }
                content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\\n${roleplayText}`;
            } else if (chosenAction === 'scavenge') {
                // --- ACTION: SCAVENGE (FIND EQUIPMENT) ---
                const scavengeRoll = Math.random();
                if (scavengeRoll < 0.40) {
                    const weapon = this.WEAPONS[Math.floor(Math.random() * this.WEAPONS.length)];
                    if (pZero.stats) {
                        pZero.stats.sucTanCong = (pZero.stats.sucTanCong || 30) + weapon.bonusAtk;
                    }
                } else if (scavengeRoll < 0.80) {
                    const armor = this.ARMORS[Math.floor(Math.random() * this.ARMORS.length)];
                    if (pZero.stats) {
                        pZero.stats.maxSinhLuc = (pZero.stats.maxSinhLuc || 500) + armor.bonusHp;
                        pZero.stats.sinhLuc = Math.min(pZero.stats.maxSinhLuc, (pZero.stats.sinhLuc || 0) + armor.bonusHp);
                    }
                }
                content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\\n${roleplayText}`;
            } else if (chosenAction === 'cultivate') {
                // --- ACTION: CULTIVATE ---
                const expGained = Math.floor(Math.random() * 30) + 20; // 20 - 50 EXP
                if (pZero.stats) {
                    const oldMaxExp = pZero.stats.maxKinhNghiem || 100;
                    this.gainExperience(pZero, expGained);
                }
                content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\\n${roleplayText}`;
            } else if (chosenAction === 'interaction') {
                // --- ACTION: FRIENDLY INTERACTION ---
                content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\\n${roleplayText}`;
            } else if (chosenAction === 'combat') {
                // --- ACTION: COMBAT (Mechanics + AI Text) ---
                if (targetId) {
                    let targetLocationId = 'Thế giới bên ngoài';
                    let opponentNpcObj: NPC | undefined;
                    let opponentBeastObj: YeuThu | undefined;
                    let isOpponentMc = targetType === 'player';

                    if (targetType === 'player') {
                        targetLocationId = updatedKb.currentLocationId || 'Thế giới bên ngoài';
                    } else if (targetType === 'npc') {
                        opponentNpcObj = updatedKb.discoveredNPCs.find(n => n.id === targetId);
                        if (opponentNpcObj) {
                            targetLocationId = opponentNpcObj.locationId || 'Thế giới bên ngoài';
                        }
                    } else if (targetType === 'beast') {
                        opponentBeastObj = updatedKb.discoveredYeuThu?.find(b => b.id === targetId);
                        if (opponentBeastObj) {
                            targetLocationId = opponentBeastObj.locationId || 'Thế giới bên ngoài';
                        }
                    }

                    if (pZero.locationId !== targetLocationId) {
                        // Di chuyển về phía mục tiêu
                        const nextLocId = this.findNextLocationStep(updatedKb, pZero.locationId || '', targetLocationId);
                        pZero.locationId = nextLocId;
                        content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\\n${roleplayText}\\n*(Đang truy vết mục tiêu ${targetName} qua bản đồ)*`;
                    } else {
                        // Encounter!
                        let opponentPower = 100;
                        if (isOpponentMc) {
                            const mcAtk = updatedKb.playerStats.sucTanCong || 35;
                            const mcMaxHp = updatedKb.playerStats.maxSinhLuc || 500;
                            opponentPower = mcAtk + Math.floor(mcMaxHp / 10);
                        } else if (targetType === 'npc' && opponentNpcObj) {
                            const oppAtk = opponentNpcObj.stats?.sucTanCong || 30;
                            const oppMaxHp = opponentNpcObj.stats?.maxSinhLuc || 400;
                            opponentPower = oppAtk + Math.floor(oppMaxHp / 10);
                        } else {
                            opponentPower = Math.floor(Math.random() * 50) + 40; // 40-90 power
                        }

                        if (isOpponentMc) {
                            content = `🗡️ **[ĐỤNG ĐỘ TRỰC TIẾP VỚI P0]**\\n[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**:\\n${roleplayText}\\n\\n[BEGIN_COMBAT: opponentIds="${pZero.id}"]`;

                            updatedKb.pendingCombat = {
                                opponentIds: [pZero.id],
                                allyIds: [],
                                surrenderedNpcIds: [],
                                analyzed: false,
                                enemy: { ids: [pZero.id] },
                                analysis: null
                            };
                        } else {
                            const pAtk = pZero.stats?.sucTanCong || 35;
                            const pMaxHp = pZero.stats?.maxSinhLuc || 500;
                            const pZeroPower = pAtk + Math.floor(pMaxHp / 10);

                            const pZeroRoll = pZeroPower + Math.floor(Math.random() * 50);
                            const opponentRoll = opponentPower + Math.floor(Math.random() * 50);

                            if (pZeroRoll >= opponentRoll) {
                                const expWin = Math.floor(Math.random() * 20) + 15;
                                if (pZero.stats) {
                                    this.gainExperience(pZero, expWin);
                                }
                                if (targetType === 'npc' && opponentNpcObj && opponentNpcObj.stats) {
                                    opponentNpcObj.stats.sinhLuc = Math.max(0, (opponentNpcObj.stats.sinhLuc || 0) - Math.floor(pZeroRoll / 2));
                                    if (opponentNpcObj.stats.sinhLuc === 0) {
                                        opponentNpcObj.status = 'Đã chết';
                                    }
                                } else if (targetType === 'beast' && opponentBeastObj && opponentBeastObj.stats) {
                                    opponentBeastObj.stats.sinhLuc = Math.max(0, (opponentBeastObj.stats.sinhLuc || 0) - Math.floor(pZeroRoll / 2));
                                }
                                content = `🗡️ **[P0 CHIẾN ĐẤU]**\\n[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**:\\n${roleplayText}\\n\\n-> **Kết quả:** Thắng cuộc, nhận ${expWin} EXP!`;
                            } else {
                                if (pZero.stats) {
                                    pZero.stats.sinhLuc = Math.max(0, (pZero.stats.sinhLuc || 0) - Math.floor(opponentRoll / 2));
                                }
                                content = `🗡️ **[P0 CHIẾN ĐẤU]**\\n[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**:\\n${roleplayText}\\n\\n-> **Kết quả:** Thất bại, sinh lực suy giảm!`;
                            }
                        }
                    }
                } else {
                    content = `[Người chơi số 0 - Vị trí ${index + 1}] **${pZero.name}**\\n${roleplayText}`;
                }
            }
"""
        out_lines.append(new_block)
        continue

    if skip and line.strip().startswith("// Save action to log history of Player Zero"):
        skip = False
        out_lines.append(line)
        continue

    if not skip:
        out_lines.append(line)

with open('services/PlayerZeroService.ts', 'w') as f:
    f.writelines(out_lines)

print("Updated PlayerZeroService.ts")
