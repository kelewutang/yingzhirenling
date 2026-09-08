#!/usr/bin/env python3
"""Explicit, deterministic Source Han Serif subset generator for PBZ Serif."""

import argparse
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', required=True, type=Path)
    parser.add_argument('--corpus', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    return parser.parse_args()


def replace_font_names(font):
    name_table = font['name']
    names = {
        1: 'PBZ Serif',
        2: 'Regular',
        4: 'PBZ Serif',
        6: 'PBZSerif',
        16: 'PBZ Serif',
        17: 'Regular',
        21: 'PBZ Serif',
        25: 'PBZSerif',
    }
    for record in name_table.names:
        if record.nameID in names:
            name_table.setName(names[record.nameID], record.nameID, record.platformID, record.platEncID, record.langID)
    for name_id, value in names.items():
        if not any(record.nameID == name_id for record in name_table.names):
            name_table.setName(value, name_id, 3, 1, 0x0409)


def main():
    args = parse_args()
    corpus = args.corpus.read_text(encoding='utf-8')
    font = TTFont(args.source, recalcTimestamp=False)
    instantiateVariableFont(font, {'wght': (400, 700)}, inplace=True)

    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_legacy = True
    options.name_languages = ['*']
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(text=corpus)
    subsetter.subset(font)
    replace_font_names(font)

    if 'fvar' not in font:
        raise RuntimeError('PBZ Serif subset unexpectedly lost its variable font axis')
    weight_axis = next((axis for axis in font['fvar'].axes if axis.axisTag == 'wght'), None)
    if weight_axis is None or weight_axis.minValue != 400 or weight_axis.maxValue != 700:
        raise RuntimeError('PBZ Serif subset must retain only the 400-700 wght range')

    args.output.parent.mkdir(parents=True, exist_ok=True)
    font.flavor = 'woff2'
    font.save(args.output, reorderTables=True)
    print(f'PBZ Serif subset written: {args.output} ({args.output.stat().st_size} bytes)')


if __name__ == '__main__':
    main()
