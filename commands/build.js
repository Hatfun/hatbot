"use strict";

const Discord = require('discord.js-light');
const fs = require('fs');
const readline = require('readline');
const logger = require('../libs/logger.js')

const Base64 = require('../libs/base64.js').Base64;
const RawDeflate = {...require('../libs/rawdeflate.js').RawDeflate, ...require('../libs/rawinflate.js').RawDeflate};
const download = require('../libs/download.js').download;

let ItemOBJ = [];
let cardOBJ = [];
let HS_ENCHANTS = [];
let MALANGDO_ENCHANTS = [];
let SQI_BONUS = [];
const JobName =
["Novice", //0
"Swordsman", //1
"Thief", //2
"Acolyte", //3
"Archer", //4
"Magician", //5
"Merchant", //6
"Knight", //7
"Assassin", //8
"Priest", //9
"Hunter", //10
"Wizard", //11
"Blacksmith", //12
"Crusader", //13
"Rogue", //14
"Monk", //15
"Bard", //16
"Dancer", //17
"Sage", //18
"Alchemist", //19
"Super Novice", //20
"Lord Knight", //21
"Assassin Cross", //22
"High Priest", //23
"Sniper", //24
"High Wizard", //25
"Whitesmith", //26
"Paladin", //27
"Stalker", //28
"Champion", //29
"Clown", //30
"Gypsy", //31
"Professor", //32
"Creator", //33
"High Novice", //34
"High Swordsman", //35
"High Thief", //36
"High Acolyte", //37
"High Archer", //38
"High Magician", //39
"High Merchant", //40
"Taekwon Kid", //41
"Star Gladiator", //42
"Soul Linker", //43
"Ninja", //44
"Gunslinger"]; //45

const n_NtoS2 =["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z","A","B","C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W","X","Y","Z","0","1","2","3","4","5","6","7","8","9"];

function StoNx(n){
    n += "";
    for(var i=0;i<=61;i++)
        if(n == n_NtoS2[i])
            return i;
}

function StoN2(n){
    n += "";
    var keta = n.length;
    if(keta == 3){
        var w = n.charAt(0);
        var x = StoNx(w) * 62 * 62;
        w = n.charAt(1);
        x += StoNx(w) * 62;
        w = n.charAt(2);
        x += StoNx(w);
    }else if(keta == 2){
        var w = n.charAt(0);
        var x = StoNx(w) * 62;
        w = n.charAt(1);
        x += StoNx(w);
    }else{
        var w = n.charAt(0);
        var x = StoNx(w);
    }
    return x;
}

const class_to_properties = {
    'lkt': {
        job: 'Lord Knight',
        skills:
            ['Bash', 'Endure', 'Increase HP Recovery', 'Magnum Break', 'Provoke', 'Sword Mastery', '2H Sword Mastery',
             'Counter Attack', 'Bowling Bash', 'Brandish Spear', 'Cavalier Mastery', 'Pierce', 'Peco Peco Ride',
             'Spear Boomerang', 'Spear Mastery', 'Spear Stab', '2H Quicken', 'Aura Blade', 'Parry', 'Concentration',
             'Tension Relax', 'Berserk', 'Spiral Pierce', 'Head Crush', 'Joint Beat'],
        skills_ordered:
            [['Sword Mastery', '2H Sword Mastery', 'Increase HP Recovery', 'Bash', 'Magnum Break', 'Provoke', 'Endure'],
             ['Peco Peco Ride', 'Cavalier Mastery', 'Spear Mastery',
              '2H Quicken', 'Counter Attack', 'Bowling Bash', 'Parry',
              'Pierce', 'Spear Stab', 'Spiral Pierce', 'Brandish Spear', 'Spear Boomerang', 'Head Crush', 'Joint Beat',
              'Aura Blade', 'Concentration', 'Tension Relax', 'Berserk']]
    },
    'asc': {
        job: 'Assassin Cross',
        skills:
            ['Double Attack', 'Detoxify', 'Envenom', 'Hiding', 'Improve Dodge', 'Steal',
             'Cloaking', 'Enchant Poison', 'Grimtooth', 'Katar Mastery', 'Lefthand Mastery', 'Poison React', 'Righthand Mastery',
             'Sonic Blow', 'Venom Dust', 'Venom Splasher',
             'Advanced Katar Mastery', 'Soul Breaker', 'Meteor Assault', 'Create Deadly Poison', 'Enchant Deadly Poison'],
        skills_ordered:
            [['Double Attack', 'Detoxify', 'Envenom', 'Hiding', 'Improve Dodge', 'Steal'],
             ['Cloaking', 'Enchant Poison', 'Grimtooth', 'Katar Mastery', 'Lefthand Mastery', 'Poison React', 'Righthand Mastery',
              'Sonic Blow', 'Venom Dust', 'Venom Splasher',
              'Advanced Katar Mastery', 'Soul Breaker', 'Meteor Assault', 'Create Deadly Poison', 'Enchant Deadly Poison']]
    },
    'snp': {
        job: 'Sniper',
        skills:
            ['Arrow Shower', 'Improve Concentration', 'Double Strafe', 'Owl\'s Eye', 'Vulture\'s Eye',
             'Ankle Snare', 'Blast Mine', 'Blitz Beat', 'Beast Bane', 'Claymore Trap', 'Detect', 'Falcon Mastery', 'Flasher',
             'Freezing Trap', 'Landmine', 'Remove Trap', 'Skid Trap', 'Shockwave Trap', 'Sandman', 'Spring Trap', 'Steel Crow', 'Talkie Box',
             'True Sight', 'Falcon Assault', 'Sharp Shooting', 'Wind Walk'],
        skills_ordered:
            [['Arrow Shower', 'Improve Concentration', 'Double Strafe', 'Owl\'s Eye', 'Vulture\'s Eye'],
             ['Ankle Snare', 'Blast Mine', 'Blitz Beat', 'Beast Bane', 'Claymore Trap', 'Detect', 'Falcon Mastery', 'Flasher',
             'Freezing Trap', 'Landmine', 'Remove Trap', 'Skid Trap', 'Shockwave Trap', 'Sandman', 'Spring Trap', 'Steel Crow', 'Talkie Box',
             'True Sight', 'Falcon Assault', 'Sharp Shooting', 'Wind Walk']]
    },
    'hpr': {
        job: 'High Priest',
        skills:
            ['Angelus', 'Aqua Benedicta', 'Blessing', 'Cure', 'Decrease Agi', 'Demon Bane', 'Divine Protection', 'Heal',
             'Increase Agi', 'Pneuma', 'Ruwach', 'Signum Crucis', 'Teleport', 'Warp Portal',
             'Aspersio', 'BSS', 'Increase SP Recovery', 'Gloria', 'Imposito Manus', 'Kyrie Eleison', 'Lex Aeterna', 'Lex Divina',
             'Mace Mastery', 'Magnus Exorcismus', 'Magnificat', 'Status Recovery', 'Resurrection', 'Safety Wall', 'Sanctuary',
             'Slow Poison', 'Suffragium', 'Turn Undead', 'Assumptio', 'Basilica', 'Meditatio', 'Mana Recharge'],
        skills_ordered:
            [['Angelus', 'Aqua Benedicta', 'Blessing', 'Cure', 'Decrease Agi', 'Demon Bane', 'Divine Protection', 'Heal',
              'Increase Agi', 'Pneuma', 'Ruwach', 'Signum Crucis', 'Teleport', 'Warp Portal'],
             ['Aspersio', 'BSS', 'Increase SP Recovery', 'Gloria', 'Imposito Manus', 'Kyrie Eleison', 'Lex Aeterna', 'Lex Divina',
              'Mace Mastery', 'Magnus Exorcismus', 'Magnificat', 'Status Recovery', 'Resurrection', 'Safety Wall', 'Sanctuary',
              'Slow Poison', 'Suffragium', 'Turn Undead', 'Assumptio', 'Basilica', 'Meditatio', 'Mana Recharge']]
    },
    'hwz': {
        job: 'High Wizard',
        skills:
            ['Cold Bolt', 'Fire Ball', 'Fire Bolt', 'Frost Diver', 'Increase SP Recovery', 'Fire Wall', 'Lightning Bolt',
             'Napalm Beat', 'Safety Wall', 'Sight', 'Soul Strike', 'Stone Curse', 'Thunder Storm',
             'Monster Property', 'Earth Spike', 'Fire Pillar', 'Frost Nova', 'Heaven\'s Drive', 'Ice Wall', 'Jupitel Thunder',
             'Lord of Vermillion', 'Meteor Storm', 'Quagmire', 'Storm Gust', 'Sightrasher', 'Water Ball',
             'Soul Drain', 'Magic Crasher', 'Amplify Magic Power', 'Napalm Vulcan', 'Gravitational Field', 'Ganbantein'],
        skills_ordered:
            [['Cold Bolt', 'Fire Ball', 'Fire Bolt', 'Frost Diver', 'Increase SP Recovery', 'Fire Wall', 'Lightning Bolt',
              'Napalm Beat', 'Safety Wall', 'Sight', 'Soul Strike', 'Stone Curse', 'Thunder Storm'],
             ['Earth Spike', 'Fire Pillar', 'Frost Nova', 'Heaven\'s Drive', 'Ice Wall', 'Jupitel Thunder', 'Lord of Vermillion',
              'Meteor Storm', 'Quagmire', 'Storm Gust', 'Sightrasher', 'Water Ball',
              'Soul Drain', 'Magic Crasher', 'Amplify Magic Power', 'Napalm Vulcan', 'Gravitational Field', 'Ganbantein']]
    },
    'wsm': {
        job: 'Whitesmith',
        skills:
            ['Pushcart', 'Discount', 'Identify', 'Enlarge Weight Limit', 'Mammonite', 'Overcharge', 'Vending',
             'Smith 2H Sword', 'Adrenaline Rush', 'Smith Axe', 'Smith Dagger', 'Enchanted Stone Craft', 'Ore Discovery',
             'Hilt Binding', 'Hammer Fall', 'Iron Tempering', 'Smith Knucklebrace', 'Smith Mace', 'Maximize Power', 'Oridecon Research',
             'Over Thrust', 'Repair Weapon', 'Skin Tempering', 'Smith Spear', 'Steel Tempering', 'Smith Sword', 'Weapon Perfection', 'Weaponry Research',
             'Melt Down', 'Cart Boost', 'Upgrade Weapon', 'Cart Termination', 'Maximum Over Thrust'],
        skills_ordered:
            [['Pushcart', 'Discount', 'Identify', 'Enlarge Weight Limit', 'Mammonite', 'Overcharge', 'Vending'],
             ['Smith 2H Sword', 'Adrenaline Rush', 'Smith Axe', 'Smith Dagger', 'Enchanted Stone Craft', 'Ore Discovery',
              'Hilt Binding', 'Hammer Fall', 'Iron Tempering', 'Smith Knucklebrace', 'Smith Mace', 'Maximize Power', 'Oridecon Research',
              'Over Thrust', 'Repair Weapon', 'Skin Tempering', 'Smith Spear', 'Steel Tempering', 'Smith Sword', 'Weapon Perfection', 'Weaponry Research',
              'Melt Down', 'Cart Boost', 'Upgrade Weapon', 'Cart Termination', 'Maximum Over Thrust']]
    },
    'pld': {
        job: 'Paladin',
        skills:
            ['Bash', 'Endure', 'Increase HP Recovery', 'Magnum Break', 'Provoke', 'Sword Mastery', '2H Sword Mastery',
             'Faith', 'Auto Guard', 'Shield Charge', 'Shield Boomerang', 'Reflect Shield', 'Holy Cross', 'Grand Cross', 'Devotion', 'Providence',
             'Defender', 'Spear Quicken', 'Spear Mastery', 'Peco Peco Ride', 'Cavalier Mastery', 'Heal', 'Demon Bane', 'Divine Protection', 'Cure',
             'Pressure', 'Sacrifice', 'Gospel', 'Shield Chain'],
        skills_ordered:
            [['Sword Mastery', '2H Sword Mastery', 'Increase HP Recovery', 'Bash', 'Magnum Break', 'Provoke', 'Endure'],
             ['Faith', 'Auto Guard', 'Shield Charge', 'Shield Boomerang', 'Reflect Shield', 'Holy Cross', 'Grand Cross', 'Devotion', 'Providence',
              'Defender', 'Spear Quicken', 'Spear Mastery', 'Peco Peco Ride', 'Cavalier Mastery', 'Heal', 'Demon Bane', 'Divine Protection', 'Cure',
              'Pressure', 'Sacrifice', 'Gospel', 'Shield Chain']]
    },
    'stk': {
        job: 'Stalker',
        skills:
            ['Double Attack', 'Detoxify', 'Envenom', 'Hiding', 'Improve Dodge', 'Steal',
             'Snatcher', 'Steal Coin', 'Backstab', 'Tunnel Drive', 'Raid', 'Sword Mastery', 'Strip Weapon', 'Strip Shield', 'Strip Armor', 'Strip Helm',
             'Vulture\'s Eye', 'Double Strafe', 'Remove Trap', 'Intimidate', 'Graffiti', 'Flag Graffiti', 'Cleaner', 'Gangster\'s Paradise',
             'Haggle', 'Plagiarism'],
        skills_ordered:
            [['Double Attack', 'Detoxify', 'Envenom', 'Hiding', 'Improve Dodge', 'Steal'],
             ['Snatcher', 'Steal Coin', 'Backstab', 'Tunnel Drive', 'Raid', 'Sword Mastery', 'Strip Weapon', 'Strip Shield', 'Strip Armor', 'Strip Helm',
              'Vulture\'s Eye', 'Double Strafe', 'Remove Trap', 'Intimidate', 'Graffiti', 'Flag Graffiti', 'Cleaner', 'Gangster\'s Paradise',
              'Haggle', 'Plagiarism']]
    },
    'clw': {
        job: 'Clown',
        skills:
            ['Arrow Shower', 'Improve Concentration', 'Double Strafe', 'Owl\'s Eye', 'Vulture\'s Eye',
             'Music Lesson', 'Melody Strike', 'Dissonance', 'Frost Joke', 'A Whistle', 'Assassin Cross of Sunset', 'Poem of Bragi',
             'Apple of Idun', 'Amp', 'Encore', 'Lullaby', 'Mr. Kim A Rich Man', 'Down Tempo', 'A Drum on the Battlefield',
             'The Ring of Nibelungen', 'Loki\'s Veil', 'Into the Abyss', 'Invulnerable Siegfried', 'Arrow Vulcan', 'Moonlit Water Mill',
             'Marionette Control', 'Longing for Freedom', 'Wand of Hermode', 'Tarot Card of Fate'],
        skills_ordered:
            [['Arrow Shower', 'Improve Concentration', 'Double Strafe', 'Owl\'s Eye', 'Vulture\'s Eye'],
             ['Music Lesson', 'Melody Strike', 'Dissonance', 'Frost Joke', 'A Whistle', 'Assassin Cross of Sunset', 'Poem of Bragi',
             'Apple of Idun', 'Amp', 'Encore', 'Lullaby', 'Mr. Kim A Rich Man', 'Down Tempo', 'A Drum on the Battlefield',
             'The Ring of Nibelungen', 'Loki\'s Veil', 'Into the Abyss', 'Invulnerable Siegfried', 'Arrow Vulcan', 'Moonlit Water Mill',
             'Marionette Control', 'Longing for Freedom', 'Wand of Hermode', 'Tarot Card of Fate']]
    },
    'chp': {
        job: 'Champion',
        skills:
            ['Angelus', 'Aqua Benedicta', 'Blessing', 'Cure', 'Decrease Agi', 'Demon Bane', 'Divine Protection', 'Heal',
             'Increase Agi', 'Pneuma', 'Ruwach', 'Signum Crucis', 'Teleport', 'Warp Portal',
             'Iron Fists', 'Spirits Recovery', 'Summon Spirit Sphere', 'Absorb Spirits', 'Triple Attack', 'Chain Combo',
             'Combo Finish', 'Body Relocation', 'Dodge', 'Finger Offensive', 'Investigate', 'Blade Stop', 'Critical Explosion',
             'Steel Body', 'Asura Strike', 'Palm Push Strike', 'Tiger Knuckle Fist', 'Chain Crush Combo', 'Dangerous Soul Collect'],
        skills_ordered:
            [['Angelus', 'Aqua Benedicta', 'Blessing', 'Cure', 'Decrease Agi', 'Demon Bane', 'Divine Protection', 'Heal',
              'Increase Agi', 'Pneuma', 'Ruwach', 'Signum Crucis', 'Teleport', 'Warp Portal'],
             ['Iron Fists', 'Spirits Recovery', 'Summon Spirit Sphere', 'Absorb Spirits', 'Triple Attack', 'Chain Combo',
              'Combo Finish', 'Body Relocation', 'Dodge', 'Finger Offensive', 'Investigate', 'Blade Stop', 'Critical Explosion',
              'Steel Body', 'Asura Strike', 'Palm Push Strike', 'Tiger Knuckle Fist', 'Chain Crush Combo', 'Dangerous Soul Collect']]
    },
    'pro': {
        job: 'Professor',
        skills:
            ['Cold Bolt', 'Fire Ball', 'Fire Bolt', 'Frost Diver', 'Increase SP Recovery', 'Fire Wall', 'Lightning Bolt',
             'Napalm Beat', 'Safety Wall', 'Sight', 'Soul Strike', 'Stone Curse', 'Thunder Storm',
             'Advanced Book', 'Cast Cancel', 'Magic Rod', 'Spell Breaker', 'Free Cast', 'Hindsight', 'Flame Launcher',
             'Frost Weapon', 'Lightning Loader', 'Seismic Weapon', 'Dragonology', 'Volcano', 'Deluge', 'Violent Gale',
             'Land Protector', 'Dispell', 'Abracadabra', 'Earth Spike', 'Heaven\'s Drive', 'Monster Property', 'Health Conversion',
             'Soul Change', 'Soul Burn', 'Mind Breaker', 'Memorize', 'Wall of Fog', 'Spider Web', 'Double Casting'],
        skills_ordered:
            [['Cold Bolt', 'Fire Ball', 'Fire Bolt', 'Frost Diver', 'Increase SP Recovery', 'Fire Wall', 'Lightning Bolt',
              'Napalm Beat', 'Safety Wall', 'Sight', 'Soul Strike', 'Stone Curse', 'Thunder Storm'],
             ['Advanced Book', 'Cast Cancel', 'Magic Rod', 'Spell Breaker', 'Free Cast', 'Hindsight', 'Flame Launcher',
             'Frost Weapon', 'Lightning Loader', 'Seismic Weapon', 'Dragonology', 'Volcano', 'Deluge', 'Violent Gale',
             'Land Protector', 'Dispell', 'Abracadabra', 'Earth Spike', 'Heaven\'s Drive', 'Monster Property', 'Health Conversion',
             'Soul Change', 'Soul Burn', 'Mind Breaker', 'Memorize', 'Wall of Fog', 'Spider Web', 'Double Casting']]
    },
    'bio': {
        job: 'Biochemist',
        skills:
            ['Pushcart', 'Discount', 'Identify', 'Enlarge Weight Limit', 'Mammonite', 'Overcharge', 'Vending',
             'Axe Mastery', 'Potion Research', 'Pharmacy', 'Demonstration', 'Acid Terror', 'Potion Pitcher', 'Bio Cannibalize', 'Sphere Mine',
             'Chemical Protection Weapon', 'Chemical Protection Shield', 'Chemical Protection Armor', 'Chemical Protection Helm',
             'Slim Potion Pitcher', 'Full Chemical Protection', 'Acid Demonstration', 'Plant Cultivation',
             'Call Homunculus', 'Rest', 'Resurrect Homunculus'
            ],
        skills_ordered:
            [['Pushcart', 'Discount', 'Identify', 'Enlarge Weight Limit', 'Mammonite', 'Overcharge', 'Vending'],
             ['Axe Mastery', 'Potion Research', 'Pharmacy', 'Demonstration', 'Acid Terror', 'Potion Pitcher', 'Bio Cannibalize', 'Sphere Mine',
              'Chemical Protection Weapon', 'Chemical Protection Shield', 'Chemical Protection Armor', 'Chemical Protection Helm',
              'Slim Potion Pitcher', 'Full Chemical Protection', 'Acid Demonstration', 'Plant Cultivation',
              'Call Homunculus', 'Rest', 'Resurrect Homunculus']]
    },
    'tae': {
        job: 'Star Gladiator',
        skills:
            ['Sprint', 'Tornado Stance', 'Tornado Kick', 'Heel Drop Stance', 'Heel Drop', 'Roundhouse Stance', 'Roundhouse',
             'Counter Kick Stance', 'Counter Kick', 'Tumbling', 'Flying Kick', 'Peaceful Break', 'Happy Break', 'Kihop',
             'Warm Wind', 'Leap', 'Taekwon Mission',
             'Feeling of the Sun, Moon and Stars', 'Warmth of the Sun', 'Warmth of the Moon', 'Warmth of the Stars',
             'Hatred of the Sun, Moon and Stars', 'Anger of the Sun', 'Anger of the Moon', 'Anger of the Stars',
             'Comfort of the Sun', 'Comfort of the Moon', 'Comfort of the Stars',
             'Blessing of the Sun', 'Blessing of the Moon', 'Blessing of the Stars',
             'Demon of the Sun, Moon and Stars', 'Friend of the Sun, Moon and Stars', 'Knowledge of the Sun, Moon and Stars',
             'Union of the Sun, Moon and Stars'],
        skills_ordered:
            [['Sprint', 'Tornado Stance', 'Tornado Kick', 'Heel Drop Stance', 'Heel Drop', 'Roundhouse Stance', 'Roundhouse',
              'Counter Kick Stance', 'Counter Kick', 'Tumbling', 'Flying Kick', 'Peaceful Break', 'Happy Break', 'Kihop',
              'Warm Wind', 'Leap', 'Taekwon Mission'],
             ['Feeling of the Sun, Moon and Stars', 'Warmth of the Sun', 'Warmth of the Moon', 'Warmth of the Stars',
              'Hatred of the Sun, Moon and Stars', 'Anger of the Sun', 'Anger of the Moon', 'Anger of the Stars',
              'Comfort of the Sun', 'Comfort of the Moon', 'Comfort of the Stars',
              'Blessing of the Sun', 'Blessing of the Moon', 'Blessing of the Stars',
              'Demon of the Sun, Moon and Stars', 'Friend of the Sun, Moon and Stars', 'Knowledge of the Sun, Moon and Stars',
              'Union of the Sun, Moon and Stars']]
    },
    'slk': {
        job: 'Soul Linker',
        skills:
            ['Sprint', 'Tornado Stance', 'Tornado Kick', 'Heel Drop Stance', 'Heel Drop', 'Roundhouse Stance', 'Roundhouse',
             'Counter Kick Stance', 'Counter Kick', 'Tumbling', 'Flying Kick', 'Peaceful Break', 'Happy Break', 'Kihop',
             'Warm Wind', 'Leap', 'Taekwon Mission',
             'Alchemist Spirit', 'Monk Spirit', 'Star Gladiator Spirit', 'Sage Spirit', 'Crusader Spirit',
             'Super Novice Spirit', 'Knight Spirit', 'Wizard Spirit', 'Priest Spirit', 'Bard & Dancer Spirit',
             'Rogue Spirit', 'Assassin Spirit', 'Blacksmith Spirit', 'Hunter Spirit', 'Soul Linker Spirit', 'Rebirth Spirit',
             'Kaizel', 'Kaahi', 'Kaupe', 'Kaite', 'Kaina', 'Estin', 'Estun', 'Esma', 'Eswoo', 'Eske', 'Eska'],
        skills_ordered:
            [['Sprint', 'Tornado Stance', 'Tornado Kick', 'Heel Drop Stance', 'Heel Drop', 'Roundhouse Stance', 'Roundhouse',
              'Counter Kick Stance', 'Counter Kick', 'Tumbling', 'Flying Kick', 'Peaceful Break', 'Happy Break', 'Kihop',
              'Warm Wind', 'Leap', 'Taekwon Mission'],
             ['Alchemist Spirit', 'Monk Spirit', 'Star Gladiator Spirit', 'Sage Spirit', 'Crusader Spirit',
              'Super Novice Spirit', 'Knight Spirit', 'Wizard Spirit', 'Priest Spirit', 'Bard & Dancer Spirit',
              'Rogue Spirit', 'Assassin Spirit', 'Blacksmith Spirit', 'Hunter Spirit', 'Soul Linker Spirit', 'Rebirth Spirit',
              'Kaizel', 'Kaahi', 'Kaupe', 'Kaite', 'Kaina', 'Estin', 'Estun', 'Esma', 'Eswoo', 'Eske', 'Eska']]
    },
    'nov': {
        job: 'Super Novice',
        skills:
            ['Bash', 'Endure', 'Increase HP Recovery', 'Magnum Break', 'Provoke', 'Sword Mastery',
             'Angelus', 'Aqua Benedicta', 'Blessing', 'Cure', 'Decrease Agi', 'Demon Bane', 'Divine Protection', 'Heal',
             'Increase Agi', 'Pneuma', 'Ruwach', 'Signum Crucis', 'Teleport', 'Warp Portal',
             'Cold Bolt', 'Fire Ball', 'Fire Bolt', 'Frost Diver', 'Increase SP Recovery', 'Fire Wall', 'Lightning Bolt',
             'Napalm Beat', 'Safety Wall', 'Sight', 'Soul Strike', 'Stone Curse', 'Thunder Storm',
             'Double Attack', 'Detoxify', 'Envenom', 'Hiding', 'Improve Dodge', 'Steal',
             'Improve Concentration', 'Owl\'s Eye', 'Vulture\'s Eye',
             'Pushcart', 'Discount', 'Identify', 'Enlarge Weight Limit', 'Mammonite', 'Overcharge', 'Vending'],
        skills_ordered:
            [['Bash', 'Endure', 'Increase HP Recovery', 'Magnum Break', 'Provoke', 'Sword Mastery',
              'Angelus', 'Aqua Benedicta', 'Blessing', 'Cure', 'Decrease Agi', 'Demon Bane', 'Divine Protection', 'Heal',
              'Increase Agi', 'Pneuma', 'Ruwach', 'Signum Crucis', 'Teleport', 'Warp Portal',
              'Cold Bolt', 'Fire Ball', 'Fire Bolt', 'Frost Diver', 'Increase SP Recovery', 'Fire Wall', 'Lightning Bolt',
              'Napalm Beat', 'Safety Wall', 'Sight', 'Soul Strike', 'Stone Curse', 'Thunder Storm',
              'Double Attack', 'Detoxify', 'Envenom', 'Hiding', 'Improve Dodge', 'Steal',
              'Improve Concentration', 'Owl\'s Eye', 'Vulture\'s Eye',
              'Pushcart', 'Discount', 'Identify', 'Enlarge Weight Limit', 'Mammonite', 'Overcharge', 'Vending']]
    },
    'nnj': {
        job: 'Ninja',
        skills:
            ['Throwing Mastery', 'Throw Skuriken', 'Throw Kunai', 'Throw Huuma Shuriken', 'Throw Zeny',
             'Reverse Tatami', 'Shadow Jump', 'Mist Slash', 'Shadow Slash', 'Cicada Skin Shed', 'Illusionary Shadow',
             'Ninja Mastery',
             'Crimson Fire Blossom', 'Crimson Fire Formation', 'Dragon Fire Formation',
             'Lightning Spear of Ice', 'Water Escape Technique', 'Falling Ice Pillar',
             'Wind Blade', 'Lightning Crash', 'North Wind',
             'Soul', 'Final Strike'],
        skills_ordered:
            [['Throwing Mastery', 'Throw Skuriken', 'Throw Kunai', 'Throw Huuma Shuriken', 'Throw Zeny',
              'Reverse Tatami', 'Shadow Jump', 'Mist Slash', 'Shadow Slash', 'Cicada Skin Shed', 'Illusionary Shadow',
              'Ninja Mastery',
              'Crimson Fire Blossom', 'Crimson Fire Formation', 'Dragon Fire Formation',
              'Lightning Spear of Ice', 'Water Escape Technique', 'Falling Ice Pillar',
              'Wind Blade', 'Lightning Crash', 'North Wind',
              'Soul', 'Final Strike']]
    },
    'gun': {
        job: 'Gunslinger',
        skills:
            ['Flip Coin', 'Fling', 'Triple Action', 'Bull\'s Eye', 'Madness Canceller', 'Adjustment', 'Increase Accuracy',
             'Magic Bullet', 'Cracker', 'Single Action', 'Snake Eyes', 'Chain Action', 'Tracking', 'Disarm', 'Piercing Shot',
             'Rapid Shower', 'Desperado', 'Gatling Fever', 'Dust', 'Full Blast', 'Spread Shot', 'Gunslinger Mine'],
        skills_ordered:
            [['Flip Coin', 'Fling', 'Triple Action', 'Bull\'s Eye', 'Madness Canceller', 'Adjustment', 'Increase Accuracy',
              'Magic Bullet', 'Cracker', 'Single Action', 'Snake Eyes', 'Chain Action', 'Tracking', 'Disarm', 'Piercing Shot',
              'Rapid Shower', 'Desperado', 'Gatling Fever', 'Dust', 'Full Blast', 'Spread Shot', 'Gunslinger Mine']]
    },
}

function singular(word) {
    if (word.length > 2) {
        if (word.toLowerCase().endsWith("'s"))
            return word.substr(0, word.length - 2);
        if (word.toLowerCase().endsWith('s'))
            return word.substr(0, word.length - 1);
    }
    return word;
}

async function refresh_calc_variable(file, variables) {
    const url = `https://kutsuru.github.io/ttcalculator/js/${file}`;
    fs.unlink(`./downloads/${file}.tmp`, async function(err) {
        await download(url, `./downloads/${file}.tmp`);
        logger.info(`Downloaded ${url}`);
        fs.unlink(`./downloads/${file}`, async function(err) {
            fs.rename(`./downloads/${file}.tmp`, `./downloads/${file}`, async function (err) {
                if (err) throw err;
                const fileStream = fs.createReadStream(`./downloads/${file}`);
                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                });
                // Note: we use the crlfDelay option to recognize all instances of CR LF
                // ('\r\n') in input.txt as a single line break.

                let var_array = variables;
                if (typeof variables == 'string') {
                    var_array = [variables];
                } else if (!Array.isArray(variables)) {
                    return;
                }

                let capture = false;
                let captured = [];
                for await (const line of rl) {
                    // Each line in input.txt will be successively available here as `line`.
                    if (var_array.some(variable => line.startsWith(`${variable} =`)) && capture === false) {
                        capture = true;
                    }

                    if (capture) {
                        captured.push(line);
                    }

                    if (line === '];' && capture === true) {
                        capture = false;
                    }
                }
                const item_obj_str = captured.join('\n');
                eval(item_obj_str); // /gawi
            });
        });
    });
}

async function refresh_calc_variables() {
    await refresh_calc_variable('item.js', 'ItemOBJ');
    await refresh_calc_variable('card.js', 'cardOBJ');
    await refresh_calc_variable('etc.js', ['HS_ENCHANTS', 'MALANGDO_ENCHANTS', 'SQI_BONUS']);
}

module.exports = {
    name: 'build',
    description: 'Save and share calc builds and skill builds',
    async setup(client) {
        await refresh_calc_variables();
    },
    async execute(message, args) {
        const BUILD = 'build'

        const cache = message.client.getCache(message.guild.id);
        const PREFIX = await message.client.getPrefix(message.guild.id);

        // Builds = Map(username, Map(build_name -> url))
        async function get_all_builds() {
            const result = new Map();
            const user_ids = await get_users();
            for (const user_id of user_ids) {
                // Only pick users of the guild
                let member = null;
                try {
                    member = await message.guild.members.fetch(user_id);
                } catch(exception) {
                }
                if (member == null)
                    continue;
                const key = `${BUILD}|${user_id}`;
                const builds_map = await cache.get(key);

                if (builds_map === undefined)
                    continue;
                result.set(user_id, { user: member.user, builds_map: builds_map });
            }
            return result;
        }

        async function get_builds(member_id = message.author.id) {
            const key = `${BUILD}|${member_id}`;
            const builds_map = await cache.get(key);
            return builds_map === undefined ? {} : builds_map;
        }

        async function get_users() {
            const key = `${BUILD}|users`;
            const users = await cache.get(key);
            return users === undefined ? [] : users;
        }

        async function save_user(member_id = message.author.id) {
            const key = `${BUILD}|users`;
            let users = await cache.get(key);
            if (users == null) {
                users = [];
            }
            if (!users.includes(member_id)) {
                users.push(member_id);
                await cache.set(key, users);
            }
        }

        async function save_builds(builds_map, member_id = message.author.id) {
            const key = `${BUILD}|${member_id}`;
            await cache.set(key, builds_map);
            await save_user(member_id);
        }

        async function delete_build(build_name, member_id = message.author.id) {
            const builds_map = await get_builds(member_id);
            if (!(build_name in builds_map)) {
                return false;
            }
            delete builds_map[build_name];
            await save_builds(builds_map, member_id);
            return true;
        }

        async function help(title, content) {
            await message.client.help(message, title, content);
        }

        if (args == null || args[0] === 'help') {
            const command = (args != null && args.length > 1) ? args[1] : null;
            if (command == null) {
                help(`${PREFIX}build`,
`Save and share calc builds and skill builds.

Available \`${PREFIX}build\` commands:
\`\`\`
- save
- list
- remove | delete
\`\`\`
Type \`${PREFIX}build help COMMAND\` with the command of your choice for more info.`
                );
            } else if (command === 'save') {
                help(`${PREFIX}build save <name> <url>`,
`Save the calc or skill link.
\`<name>\`: Build name
\`<url>\`: Must be a URL starting either by \`https://calc.talonro.com/\` or \`http://irowiki.org/~himeyasha/skill4/\`

Examples:
\`\`\`${PREFIX}build save LK ET Dual Meg https://calc.talonro.com/?_wr1Mw5EKw4JADMO7FcK/QUXDsX3CiMOiDhxse0/DpsOdesKrbExww7fDu8OeTkEQfTUlwqRtw5I2wpjCmMOTYwkyMMKHBU8WCMOBwqLDgD4Wwq7Cg8O4NRJEwqPDo8K5CVlXw4nCucOPw5rDoMK6ZnQGwpgpVgTCvSpUW8OnEMKzwqBqOsO0HMOmRkrCpjEtb0/DucKGwrvDksOQfMOaLsOyw7JSw6DDgMOibcKRK8OWwr/CvsO9D8K7w63Coj7Clg8
${PREFIX}build save LK Skill Build full spear http://irowiki.org/~himeyasha/skill4/lkt.html?10sXsOAnHXeKGFboeAcL
\`\`\``
                );
            } else if (command === 'list') {
                help(`${PREFIX}build list [<search>]`,
`Returns list of all calc links.
\`search\` _(Optional)_: If provided, returns all the builds that contain EVERY words in <search> in the build name. If not provided, all builds will be returned.

Examples:
\`\`\`${PREFIX}build list
${PREFIX}build list ET LK
\`\`\``
                );
            } else if (command === 'show') {
                help(`${PREFIX}build show <search>`,
`Display details of a build with link.
If calc build, base stats and main equipment will be shown. If skill build, the list of skills and levels will be shown.
\`search\`: Returns the build that contains EVERY words in <search> in the build name.

Examples:
\`\`\`${PREFIX}build show ET LK
\`\`\``
                );
            } else if (command === 'delete' || command === 'remove') {
                help(`${PREFIX}build remove <name>`,
`Remove build from the list of builds.
\`<name>\`: Build name

Example:
\`\`\`${PREFIX}build remove LK ET Dual Meg\`\`\``
                );
            } else {
                await message.channel.send(`❌ Unrecognized command. Check \`${PREFIX}build help\` for available commands.`)
            }
        } else if (args[0] === 'save') {
            const space_idx = args[1].lastIndexOf(' ');
            const build_name = args[1].slice(0, space_idx).trim();
            const url = args[1].slice(space_idx + 1);

            if (/^https:\/\/calc.talonro.com\/\?.+$/.exec(url) == null && /^https?:\/\/irowiki.org\/~himeyasha\/.+$/.exec(url) == null) {
                await message.channel.send("❌ Cannot recognize a calc.talonro.com or irowiki.org URL!");
            } else {
                const builds_map = await get_builds();
                if (!(build_name in builds_map)) {
                    builds_map[build_name] = url;
                    await save_builds(builds_map);
                    await message.channel.send(`✅ Successfully saved build **${build_name}**`);
                } else {
                    const confirm_filter = (reaction, user) => { return ['✅', '❌'].includes(reaction.emoji.name) && user.id === message.author.id; };
                    const confirm_message = await message.channel.send(`:grey_question: Build ${build_name} already exists. Replace existing?`);
                    confirm_message.react('✅').then(() => confirm_message.react('❌'));
                    confirm_message
                        .awaitReactions(confirm_filter, { max: 1, time: 60000, errors: ['time'] })
                        .then(async collected => {
                            const reaction = collected.first();

                            if (reaction.emoji.name !== '✅') {
                                await message.channel.send('❌ User cancelled');
                                await confirm_message.delete();
                            } else {
                                builds_map[build_name] = url;
                                await save_builds(builds_map);
                                await message.channel.send(`✅ Successfully saved build **${build_name}**`);
                                await confirm_message.delete();
                            }
                        })
                        .catch(async collected => {
                            logger.error(collected);
                            await message.channel.send("❌ Action cancelled");
                            await confirm_message.delete();
                        });
                }
            }
        } else if (args[0] === 'list') {
            let search_str = null;
            if (args.length > 1) {
                search_str = args[1].trim();
            }
            const search = search_str == null ? null : search_str.split(/\s+/).filter(e => e.trim().length > 0);
            const search_lower = search == null ? null : search.map(s => singular(s.toLowerCase()));
            const user_builds_map = await get_all_builds();
            const user_builds_array = new Map();
            for (const [user_id, ubuilds_map] of user_builds_map) {
                const builds_map = ubuilds_map.builds_map;
                const user = ubuilds_map.user;
                for (const key in builds_map) {
                    const key_split = key.toLowerCase().split(/\s+/).filter(e => e.trim().length > 0).map(s => singular(s));
                    if (search_lower == null || search_lower.every(s => key_split.includes(s))) {
                        if (!user_builds_array.has(user_id)) {
                            user_builds_array.set(user_id, []);
                        }
                        user_builds_array.get(user_id).push({user: user, name: key, url: builds_map[key]});
                    }
                }
                if (user_builds_array.has(user_id)) {
                    user_builds_array.get(user_id).sort((a, b) => a.name.localeCompare(b.name));
                }
            }

            if (user_builds_array.size == 0) {
                const search_criteria = search == null ? "" : ` matching [${search.join(", ")}]`;
                await message.channel.send(`❌ Cannot find any build${search_criteria}!`);
            } else {
                let total_length = 0;
                for (const v of user_builds_array.values()) {
                    total_length += v.length;
                }
                const s = total_length > 1 ? "s" : "";
                const field_title = search == null ? `All ${total_length} build${s}` : `${total_length} build${s} matching [${search.join(", ")}]`;

                let first_message = true;
                const chunk = 5;

                for (const [user_id, builds_array] of user_builds_array) {
                    for (var i = 0; i < builds_array.length; i += chunk) {
                        let content = builds_array.slice(i, i + chunk).map(build => `- [${build.name}](${build.url})`).join('\n');
                        if (i == 0) {
                            content = `<@${builds_array[0].user.id}>:\n` + content;
                        }
                        const embed = new Discord.MessageEmbed().setDescription(content);
                        if (first_message) {
                            embed.setTitle(field_title);
                        }

                        await message.channel.send(embed);
                        first_message = false;
                    }
                }
            }
        } else if (args[0] === 'delete' || args[0] === 'remove') {
            const build_name = args[1].trim();
            const result_deleted = await delete_build(build_name);
            if (result_deleted) {
                await message.channel.send(`✅ Successfully removed build ${build_name}`);
            } else {
                await message.channel.send(`❌ Cannot find build ${build_name}`);
            }
        } else if (args[0] === 'refreshcalc') {
            if (message.author.id != '281527853173178368') {
                await message.channel.send(`❌ Sorry! Only <@281527853173178368> is allowed to run this command`);
                return;
            }
            await refresh_calc_variables();
            await message.channel.send(`✅ Reloaded items and cards from TalonRO calculator!`);
        } else if (args[0] === 'show') {
            if (args[1] == null) {
                await message.channel.send(`❌ Usage: ${PREFIX}build show <search>`);
                return;
            }
            let search_str = args[1].trim();

            async function show_build(member_user, build) {
                if (build.url.startsWith('https://calc.talonro.com/')) {
                    let w = build.url.split("?")[1];
                    if (w.substr(0,1) == '_'){
                        w = w.replace(/_/g, '');
                        w += '='.repeat(4 - w.length % 4);
                        w = Base64.btou(RawDeflate.inflate(Base64.fromBase64(w)));
                    }
                    const w_Version = StoN2(w.substr(0,1));

                    const stats = {};
                    stats.job = StoN2(w.substr(1,2));
                    stats.base_lvl = StoN2(w.substr(3,2));
                    stats.job_lvl = StoN2(w.substr(5,2));
                    stats.str = StoN2(w.substr(7,2));
                    stats.agi = StoN2(w.substr(9,2));
                    stats.vit = StoN2(w.substr(11,2));
                    stats.dex = StoN2(w.substr(13,2));
                    stats.int = StoN2(w.substr(15,2));
                    stats.luk = StoN2(w.substr(17,2));
                    stats.weapon1 = StoN2(w.substr(23,2));
                    stats.weapon1_atk_plus = StoN2(w.substr(25,1));
                    stats.weapon1_card1 = StoN2(w.substr(26,2));
                    stats.weapon1_card2 = StoN2(w.substr(28,2));
                    stats.weapon1_card3 = StoN2(w.substr(30,2));
                    stats.weapon1_card4 = StoN2(w.substr(32,2));

                    const left_hand = StoN2(w.substr(34,2));
                    const left_hand_type = ItemOBJ[left_hand][1];
                    if (left_hand_type in [1, 2, 6]) { // dual weapon: 1 = dagger, 2 = 1h sword, 6 = 1h axe
                        stats.weapon2 = left_hand;
                        stats.weapon2_atk_plus = StoN2(w.substr(36,1));
                        stats.weapon2_card1 = StoN2(w.substr(37,2));
                        stats.weapon2_card2 = StoN2(w.substr(39,2));
                        stats.weapon2_card3 = StoN2(w.substr(41,2));
                        stats.weapon2_card4 = StoN2(w.substr(43,2));

                        stats.weapon2_name = ItemOBJ[stats.weapon2][8];
                        stats.weapon2_card_names = [];
                        if (stats.weapon2_card1 > 0)
                            stats.weapon2_card_names.push(cardOBJ[stats.weapon2_card1][2]);
                        if (stats.weapon2_card2 > 0)
                            stats.weapon2_card_names.push(cardOBJ[stats.weapon2_card2][2]);
                        if (stats.weapon2_card3 > 0)
                            stats.weapon2_card_names.push(cardOBJ[stats.weapon2_card3][2]);
                        if (stats.weapon2_card4 > 0)
                            stats.weapon2_card_names.push(cardOBJ[stats.weapon2_card4][2]);
                    } else { //  (left_hand_type == 61) for shield
                        stats.shield = left_hand;
                        stats.shield_def_plus = StoN2(w.substr(36,1));
                        stats.shield_card = StoN2(w.substr(37,2));
                        stats.shield_name = ItemOBJ[stats.shield][8];
                        stats.shield_card_name = cardOBJ[stats.shield_card][2];
                    }

                    stats.head1 = StoN2(w.substr(45,2));
                    stats.head1_card = StoN2(w.substr(47,2));
                    stats.head2 = StoN2(w.substr(49,2));
                    stats.head2_card = StoN2(w.substr(51,2));
                    stats.head3 = StoN2(w.substr(53,2));
                    stats.armor = StoN2(w.substr(55,2));
                    stats.armor_card = StoN2(w.substr(57,2));
                    stats.garment = StoN2(w.substr(59,2));
                    stats.garment_card = StoN2(w.substr(61,2));
                    stats.foot = StoN2(w.substr(63,2));
                    stats.foot_card = StoN2(w.substr(65,2));
                    stats.acces1 = StoN2(w.substr(67,2));
                    stats.acces1_card = StoN2(w.substr(69,2));
                    stats.acces2 = StoN2(w.substr(71,2));
                    stats.acces2_card = StoN2(w.substr(73,2));
                    stats.head1_def_plus = StoN2(w.substr(75,1));
                    stats.armor_def_plus = StoN2(w.substr(76,1));
                    stats.garment_def_plus = StoN2(w.substr(77,1));
                    stats.foot_def_plus = StoN2(w.substr(78,1));

                    let x = StoN2(w.substr(80,1));
                    x += 81;
                    x += (StoN2(w.substr(x,1)) == 1 ? 8 : 0);
                    x += 8;
                    x += 1;
                    x += (StoN2(w.substr(x,1)) == 1 ? 9 : 0);
                    x += 1;
                    x += (StoN2(w.substr(x,1)) == 1 ? 6 : 0);
                    let checkHIT = [0,0,0,0,0];
                    const wn = StoN2(w.substr(x+1,1));
                    checkHIT[0] = Math.floor(wn / 16);
                    checkHIT[1] = Math.floor(wn % 16 / 8);
                    checkHIT[2] = Math.floor(wn % 8 / 4);
                    checkHIT[3] = Math.floor(wn % 4 / 2);
                    checkHIT[4] = Math.floor(wn % 2 / 1);
                    x += 1;
                    x += (checkHIT[0] ? 47 : 0);
                    x += (checkHIT[1] ? 3 : 0);
                    x += (checkHIT[2] ? 2 : 0);
                    x += (checkHIT[3] ? 5 : 0);
                    x += (checkHIT[4] ? 14 : 0);
                    x += 2;
                    if (w_Version >= 1) {
                        stats.armor_hidden_enchant_idx = StoN2(w.substr(x+1,2));
                        if (stats.armor_hidden_enchant_idx > 0) {
                            stats.armor_hidden_enchant_name = HS_ENCHANTS.find(hse => hse[0] == stats.armor_hidden_enchant_idx)[1];
                        }
                        x += 2;
                    }
                    x += (w_Version >= 2 ? 2 : 0);
                    // KRIS enchant HERE if needed
                    x += 8;
                    const x_sqibonus = StoN2(w.substr(x+1,1));
                    x += 1;
                    if (x_sqibonus) {
                        stats.sqi_bonus_indexes = [
                            StoN2(w.substr(x+1,2)),
                            StoN2(w.substr(x+3,2)),
                            StoN2(w.substr(x+5,2)),
                            StoN2(w.substr(x+7,2))
                        ];
                        stats.sqi_bonus_names = stats.sqi_bonus_indexes.filter(sqib => sqib > 0).map(sqib => SQI_BONUS[sqib][3]);
                        x+=8;
                    }

                    // Check everything when converting to names
                    stats.job_name = JobName[stats.job];
                    stats.weapon1_name = ItemOBJ[stats.weapon1][8];
                    stats.weapon1_card_names = [];
                    if (stats.weapon1_card1 > 0)
                        stats.weapon1_card_names.push(cardOBJ[stats.weapon1_card1][2]);
                    if (stats.weapon1_card2 > 0)
                        stats.weapon1_card_names.push(cardOBJ[stats.weapon1_card2][2]);
                    if (stats.weapon1_card3 > 0)
                        stats.weapon1_card_names.push(cardOBJ[stats.weapon1_card3][2]);
                    if (stats.weapon1_card4 > 0)
                        stats.weapon1_card_names.push(cardOBJ[stats.weapon1_card4][2]);
                    stats.head1_name = ItemOBJ[stats.head1][8];
                    stats.head1_card_name = cardOBJ[stats.head1_card][2];
                    stats.head2_name = ItemOBJ[stats.head2][8];
                    stats.head2_card_name = cardOBJ[stats.head2_card][2];
                    stats.head3_name = ItemOBJ[stats.head3][8];
                    stats.armor_name = ItemOBJ[stats.armor][8];
                    stats.armor_card_name = cardOBJ[stats.armor_card][2];
                    stats.garment_name = ItemOBJ[stats.garment][8];
                    stats.garment_card_name = cardOBJ[stats.garment_card][2];
                    stats.foot_name = ItemOBJ[stats.foot][8];
                    stats.foot_card_name = cardOBJ[stats.foot_card][2];
                    stats.acces1_name = ItemOBJ[stats.acces1][8];
                    stats.acces1_card_name = cardOBJ[stats.acces1_card][2];
                    stats.acces2_name = ItemOBJ[stats.acces2][8];
                    stats.acces2_card_name = cardOBJ[stats.acces2_card][2];


                    function carded_gear_name(gear_name, card_names, upgrade, hidden_enchant_name) {
                        const upgrade_name = upgrade != undefined && upgrade > 0 ? `+${upgrade} ` : '';
                        const hidden_enchant = hidden_enchant_name != undefined ? ` [${hidden_enchant_name}]` : '';
                        if (Array.isArray(card_names) && card_names.length > 0) {
                            return `${upgrade_name}${gear_name}${hidden_enchant} ${card_names.map(c => '[' + c + ']').join('')}`;
                        } else if (typeof card_names == 'string' && card_names != '(No Card)') {
                            return `${upgrade_name}${gear_name}${hidden_enchant} [${card_names}]`;
                        } else {
                            return `${upgrade_name}${gear_name}${hidden_enchant}`;
                        }
                    }

                    const embed = new Discord.MessageEmbed()
                        .setAuthor(member_user.username, member_user.displayAvatarURL({format: 'jpg'}))
                        .setThumbnail('https://www.talonro.com/favicon.png')
                        .setDescription(`\n**[${build.name}](${build.url})**\n`)
                        .setTitle('TalonRO Calculator link')
                        .addFields(
                            { name: 'Job', value: stats.job_name, inline: true },
                            { name: 'Base level', value: stats.base_lvl, inline: true },
                            { name: 'Job level', value: stats.job_lvl, inline: true },
                            { name: '\u200B', value: '**BASE STATS**' },
                            { name: 'STR', value: stats.str, inline: true },
                            { name: 'AGI', value: stats.agi, inline: true },
                            { name: 'VIT', value: stats.vit, inline: true },
                            { name: 'INT', value: stats.int, inline: true},
                            { name: 'DEX', value: stats.dex, inline: true },
                            { name: 'LUK', value: stats.luk, inline: true }
                        );
                    embed.addField('\u200B', '**EQUIPMENT**')

                    embed.addField('Weapon', carded_gear_name(stats.weapon1_name, stats.weapon1_card_names, stats.weapon1_atk_plus));
                    if (stats.sqi_bonus_names != undefined) {
                        embed.addField('Bonus', stats.sqi_bonus_names.map(b => '• ' + b).join('\n'));
                    }
                    if (stats.weapon2 != null) {
                        embed.addField('Left Hand', carded_gear_name(stats.weapon2_name, stats.weapon2_card_names));
                    }
                    embed.addField('Upper', carded_gear_name(stats.head1_name, stats.head1_card_name, stats.head1_def_plus), true);
                    embed.addField('Mid', carded_gear_name(stats.head2_name, stats.head2_card_name), true);
                    embed.addField('Lower', carded_gear_name(stats.head3_name, stats.head3_card_name), true);
                    embed.addField('Armor', carded_gear_name(stats.armor_name, stats.armor_card_name, stats.armor_def_plus, stats.armor_hidden_enchant_name));
                    if (stats.weapon2 == null) {
                        embed.addField('Shield', carded_gear_name(stats.shield_name, stats.shield_card_name, stats.shield_def_plus));
                    }
                    embed.addField('Garment', carded_gear_name(stats.garment_name, stats.garment_card_name, stats.garment_def_plus));
                    embed.addField('Footgear', carded_gear_name(stats.foot_name, stats.foot_card_name, stats.foot_def_plus));
                    embed.addField('Accessory 1', carded_gear_name(stats.acces1_name, stats.acces1_card_name), true);
                    embed.addField('Accessory 2', carded_gear_name(stats.acces2_name, stats.acces2_card_name), true);

                    await message.channel.send(embed);
                } else if (/^https?:\/\/irowiki.org\/~himeyasha\/skill4\/(.+)\.html/.exec(build.url) != null) {
                    let match = /^https?:\/\/irowiki.org\/~himeyasha\/skill4\/(.+)\.html\?(.*)$/.exec(build.url);
                    if (match == null) {
                        await message.channel.send(`❌ Skill build data cannot be extracted`);
                        return;
                    }
                    const job = match[1];
                    const code = match[2];

                    function decode(code, ver) {
                        var tdata = new Array();
                        // コードVerチェック
                        if (code.substring(0,2) != ver) {
                            logger.error("iRO Wiki Skill Simulator: This code is from a different version. Please use the most recently updated simulator.");
                            return null;
                        }
                        code = code.substring(code.indexOf("0")+1);
                        code = code.replace(/9/g,"aaaaaaaaaa");
                        code = code.replace(/8/g,"aaaaaaaaa");
                        code = code.replace(/7/g,"aaaaaaaa");
                        code = code.replace(/6/g,"aaaaaaa");
                        code = code.replace(/5/g,"aaaaaa");
                        code = code.replace(/4/g,"aaaaa");
                        code = code.replace(/3/g,"aaaa");
                        code = code.replace(/2/g,"aaa");
                        code = code.replace(/1/g,"aa");

                        const tmp = code;
                        let j=0;
                        for(let i=0; i<tmp.length/2; i++){
                            const x = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(tmp.charAt(2*i));
                            const y = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ".indexOf(tmp.charAt(2*i+1));
                            const tmp2 = 52 * x + y;
                            tdata[j]   = Math.floor(tmp2/169);
                            tdata[j+1] = Math.floor((tmp2%169)/13);
                            tdata[j+2] = (tmp2%169)%13;
                            j = j+3;
                        }
                        return tdata;
                    }

                    if (!(job in class_to_properties)) {
                        await message.channel.send(`❌ Job ${job} is not suppoted yet. Please contact <@281527853173178368> to add it to the \`${PREFIX}build show\` command.`);
                        return;
                    }

                    const ver = "10";
                    const tdata = decode(code, ver);
                    if (tdata == null) {
                        await message.channel.send(`❌ Failed to load skill build`);
                        return;
                    }

                    const skills = class_to_properties[job].skills;
                    const skill_lvl_arr = [];
                    const ordered_skills = class_to_properties[job].skills_ordered;
                    const max_name_length = Math.max(...skills.map(s => s.length));
                    for (let i = 0; i < ordered_skills.length; i++) {
                        for (let j = 0; j < ordered_skills[i].length; j++) {
                            const idx = skills.indexOf(ordered_skills[i][j]);
                            if (tdata[idx] > 0) {
                                skill_lvl_arr.push({ skill: skills[idx], level: tdata[idx] });
                            }
                        }
                        if (i != ordered_skills.length - 1) {
                            skill_lvl_arr.push({ skill: '', level: '' });
                        }
                    }

                    const embed = new Discord.MessageEmbed()
                        .setAuthor(member_user.username, member_user.displayAvatarURL({format: 'jpg'}))
                        .setDescription(`\u200B\n**[${build.name}](${build.url})**\n`)
                        .setTitle('iRO Wiki Skill Simulator link');
                    // embed.addField('Skill', `${skill_lvl_arr.map(s => s.skill).join('\n')}`, true);
                    // embed.addField('Level', `${skill_lvl_arr.map(s => s.level).join('\n')}`, true);

                    embed.addField('\u200B', `\`\`\`\n${class_to_properties[job].job}\n\n${skill_lvl_arr.map(s => s.skill.padEnd(max_name_length + 4) + s.level).join('\n')}\`\`\``);

                    await message.channel.send(embed);
                }
            }

            const search = search_str.split(/\s+/).filter(e => e.trim().length > 0);
            const search_lower = search.map(s => singular(s.toLowerCase()));
            const user_builds_map = await get_all_builds();
            const user_builds_array = new Map();
            for (const [user_id, ubuilds_map] of user_builds_map) {
                const builds_map = ubuilds_map.builds_map;
                const user = ubuilds_map.user;
                for (const key in builds_map) {
                    const key_split = key.toLowerCase().split(/\s+/).filter(e => e.trim().length > 0).map(s => singular(s));
                    if (search_lower == null || search_lower.every(s => key_split.includes(s))) {
                        if (!user_builds_array.has(user_id)) {
                            user_builds_array.set(user_id, []);
                        }
                        user_builds_array.get(user_id).push({user: user, name: key, url: builds_map[key]});
                    }
                }
                if (user_builds_array.has(user_id)) {
                    user_builds_array.get(user_id).sort((a, b) => a.name.localeCompare(b.name));
                }
            }

            let total_length = 0;
            for (const v of user_builds_array.values()) {
                total_length += v.length;
            }

            if (total_length > 1) {
                const builds_array = [];
                for (const [user_id, build_array] of user_builds_array) {
                    for (const build of build_array) {
                        builds_array.push({user_id: user_id, user: build.user, name: build.name, url: build.url});
                    }
                }

                const question =
`📄 Please choose one of the builds matching **[${search.join(", ")}]**:
${builds_array.map((elt, idx) => `${idx == 0 || builds_array[idx - 1].user_id != elt.user_id ? `\n<@${elt.user_id}>:\n` : ''}\`${idx + 1}.\` ${elt.name}`).join('\n')}
`;
                const questionEmbed = new Discord.MessageEmbed().setDescription(question);
                const filter = m => m.author.id === message.author.id;
                await message.channel.send(questionEmbed).then(async () => {
                    await message.channel.awaitMessages(filter, { max: 1 })
                        .then(async collected => {
                            const reply = collected.first().content;
                            const choice = parseInt(reply);
                            if (isNaN(choice) || choice > builds_array.length) {
                                await message.channel.send('❌ Invalid choice!');
                            } else {
                                const build = builds_array[choice - 1];
                                await show_build(build.user, build);
                            }
                        })
                        .catch(async collected => {
                            logger.error(collected);
                            await message.channel.send('❌ Action cancelled');
                        });
                });
            } else if (total_length == 1) {
                const build = user_builds_array.values().next().value[0];
                await show_build(build.user, build);
            } else {
                await message.channel.send(`❌ Cannot find any build matching **[${search.join(", ")}]**!`);
                return;
            }
        }
    }
}