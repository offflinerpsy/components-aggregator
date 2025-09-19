#!/usr/bin/env node

/**
 * 🚔 СКРИПТ ОТПРАВКИ КОМАНД ОТ КООРДИНАТОРА
 * 
 * Позволяет координатору отправлять команды чатам
 */

const COORDINATOR_URL = 'http://localhost:3001';

class CommandSender {
    constructor() {
        this.coordinatorUrl = COORDINATOR_URL;
    }

    /**
     * Отправляет команду чату
     */
    async sendCommand(chatId, command, instructions = [], priority = 'normal') {
        try {
            const response = await fetch(`${this.coordinatorUrl}/api/command`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    chatId,
                    command,
                    instructions,
                    priority
                })
            });

            const result = await response.json();
            
            if (result.status === 'success') {
                console.log(`✅ КОМАНДА ОТПРАВЛЕНА: ${chatId} - ${command}`);
                console.log(`📋 ID команды: ${result.commandId}`);
                return result;
            } else {
                console.error(`❌ ОШИБКА ОТПРАВКИ: ${result.message}`);
                return null;
            }
        } catch (error) {
            console.error(`❌ ОШИБКА СВЯЗИ: ${error.message}`);
            return null;
        }
    }

    /**
     * Проверяет команды для чата
     */
    async getCommands(chatId) {
        try {
            const response = await fetch(`${this.coordinatorUrl}/api/commands/${chatId}`);
            const result = await response.json();
            
            if (result.status === 'success') {
                console.log(`📋 КОМАНДЫ ДЛЯ ${chatId}:`);
                result.commands.forEach(cmd => {
                    console.log(`  - ${cmd.id}: ${cmd.command} (${cmd.status})`);
                });
                return result.commands;
            } else {
                console.error(`❌ ОШИБКА ПОЛУЧЕНИЯ КОМАНД: ${result.message}`);
                return [];
            }
        } catch (error) {
            console.error(`❌ ОШИБКА СВЯЗИ: ${error.message}`);
            return [];
        }
    }

    /**
     * Отмечает команду как выполненную
     */
    async completeCommand(commandId, result = 'Выполнено', status = 'completed') {
        try {
            const response = await fetch(`${this.coordinatorUrl}/api/commands/${commandId}/complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    result,
                    status
                })
            });

            const responseData = await response.json();
            
            if (responseData.status === 'success') {
                console.log(`✅ КОМАНДА ОТМЕЧЕНА КАК ВЫПОЛНЕННАЯ: ${commandId}`);
                return responseData;
            } else {
                console.error(`❌ ОШИБКА ОТМЕТКИ: ${responseData.message}`);
                return null;
            }
        } catch (error) {
            console.error(`❌ ОШИБКА СВЯЗИ: ${error.message}`);
            return null;
        }
    }
}

// Если запущен напрямую
if (require.main === module) {
    const sender = new CommandSender();
    
    const command = process.argv[2];
    const chatId = process.argv[3];
    const commandText = process.argv[4];
    const instructions = process.argv.slice(5);
    
    switch (command) {
        case 'send':
            if (!chatId || !commandText) {
                console.log('Использование: node send_command.js send <chatId> <command> [instructions...]');
                process.exit(1);
            }
            sender.sendCommand(chatId, commandText, instructions);
            break;
            
        case 'get':
            if (!chatId) {
                console.log('Использование: node send_command.js get <chatId>');
                process.exit(1);
            }
            sender.getCommands(chatId);
            break;
            
        case 'complete':
            const commandId = process.argv[3];
            const result = process.argv[4] || 'Выполнено';
            if (!commandId) {
                console.log('Использование: node send_command.js complete <commandId> [result]');
                process.exit(1);
            }
            sender.completeCommand(commandId, result);
            break;
            
        default:
            console.log('🚔 КОМАНДЫ КООРДИНАТОРА:');
            console.log('  send <chatId> <command> [instructions...] - отправить команду');
            console.log('  get <chatId> - получить команды для чата');
            console.log('  complete <commandId> [result] - отметить команду как выполненную');
    }
}

module.exports = CommandSender;