import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { dateHelpers } from '../../utils/dateHelpers';
import { theme } from '../../utils/theme';

interface DateTimeSelectorProps {
  value: Date;
  onDateChange: (date: Date) => void;
  onTimeChange: (time: Date) => void;
}

/**
 * Composant de sélection de date et heure
 * Adapté pour Web (inputs HTML) et Mobile (DateTimePicker natif)
 */
export const DateTimeSelector: React.FC<DateTimeSelectorProps> = ({
  value,
  onDateChange,
  onTimeChange,
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      onDateChange(selectedDate);
    }
  };

  const handleTimeChange = (event: any, selectedTime?: Date) => {
    setShowTimePicker(false);
    if (selectedTime) {
      onTimeChange(selectedTime);
    }
  };

  const handleWebDateChange = (e: any) => {
    const newDate = dateHelpers.parseDateInput(e.target.value, value);
    onDateChange(newDate);
  };

  const handleWebTimeChange = (e: any) => {
    const newDate = dateHelpers.parseTimeInput(e.target.value, value);
    onTimeChange(newDate);
  };

  // Version Web avec inputs HTML natifs
  if (Platform.OS === 'web') {
    return (
      <View style={styles.container}>
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Date</Text>
          <input
            type="date"
            value={dateHelpers.formatForDateInput(value)}
            max={dateHelpers.getTodayMax()}
            onChange={handleWebDateChange}
            style={webInputStyle}
          />
        </View>
        
        <View style={styles.inputWrapper}>
          <Text style={styles.label}>Heure</Text>
          <input
            type="time"
            value={dateHelpers.formatForTimeInput(value)}
            onChange={handleWebTimeChange}
            style={webInputStyle}
          />
        </View>
      </View>
    );
  }

  // Version Mobile avec DateTimePicker natif
  return (
    <View style={styles.container}>
      <TouchableOpacity 
        style={styles.inputWrapper} 
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={styles.label}>Date</Text>
        <Text style={styles.value}>
          {dateHelpers.formatForDisplay.date(value)}
        </Text>
      </TouchableOpacity>
      
      <TouchableOpacity 
        style={styles.inputWrapper} 
        onPress={() => setShowTimePicker(true)}
      >
        <Text style={styles.label}>Heure</Text>
        <Text style={styles.value}>
          {dateHelpers.formatForDisplay.time(value)}
        </Text>
      </TouchableOpacity>

      {showDatePicker && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          onChange={handleDateChange}
          maximumDate={new Date()}
        />
      )}

      {showTimePicker && (
        <DateTimePicker
          value={value}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      )}
    </View>
  );
};

const webInputStyle = {
  backgroundColor: 'transparent',
  border: 'none',
  color: theme.colors.text.high,
  fontSize: 16,
  fontWeight: '500' as const,
  width: '100%',
  outline: 'none',
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: theme.colors.bg.input,
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 4,
  },
  label: {
    color: theme.colors.text.muted,
    fontSize: 12,
    marginBottom: 4,
  },
  value: {
    color: theme.colors.text.high,
    fontSize: 16,
    fontWeight: '500',
  },
});